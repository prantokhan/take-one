#include "TakeOneSceneJson.h"

#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
constexpr int32 MaxGeneratedObjects = 128;
constexpr double MaxSceneCoordinate = 100000.0;

double NumberOr(const TSharedPtr<FJsonObject>& Object, const TCHAR* Field, const double DefaultValue)
{
    if (!Object.IsValid())
    {
        return DefaultValue;
    }

    double Value = DefaultValue;
    return Object->TryGetNumberField(Field, Value) ? Value : DefaultValue;
}

FString StringOr(const TSharedPtr<FJsonObject>& Object, const TCHAR* Field, const FString& DefaultValue)
{
    if (!Object.IsValid())
    {
        return DefaultValue;
    }

    FString Value;
    return Object->TryGetStringField(Field, Value) ? Value : DefaultValue;
}

TSharedPtr<FJsonObject> ObjectOrNull(const TSharedPtr<FJsonObject>& Object, const TCHAR* Field)
{
    if (!Object.IsValid())
    {
        return nullptr;
    }

    const TSharedPtr<FJsonObject>* Value = nullptr;
    return Object->TryGetObjectField(Field, Value) && Value ? *Value : nullptr;
}

ETakeOnePrimitiveType ParsePrimitive(const FString& Value)
{
    if (Value.Equals(TEXT("sphere"), ESearchCase::IgnoreCase))
    {
        return ETakeOnePrimitiveType::Sphere;
    }
    if (Value.Equals(TEXT("cylinder"), ESearchCase::IgnoreCase))
    {
        return ETakeOnePrimitiveType::Cylinder;
    }
    if (Value.Equals(TEXT("cone"), ESearchCase::IgnoreCase))
    {
        return ETakeOnePrimitiveType::Cone;
    }
    return ETakeOnePrimitiveType::Cube;
}
}

FString FTakeOneSceneJson::SerializeGenerationRequest(const FString& Prompt)
{
    const TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetStringField(TEXT("schema_version"), TEXT("1.0"));
    Root->SetStringField(TEXT("prompt"), Prompt);

    const TSharedRef<FJsonObject> Constraints = MakeShared<FJsonObject>();
    Constraints->SetStringField(TEXT("coordinate_system"), TEXT("unreal_centimeters"));
    Constraints->SetNumberField(TEXT("max_objects"), MaxGeneratedObjects);
    Constraints->SetBoolField(TEXT("director_retains_control"), true);
    Root->SetObjectField(TEXT("constraints"), Constraints);

    FString Json;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
    FJsonSerializer::Serialize(Root, Writer);
    return Json;
}

bool FTakeOneSceneJson::DeserializeScene(const FString& Json, FTakeOneSceneSpec& OutScene, FString& OutError)
{
    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OutError = TEXT("The scene service returned invalid JSON.");
        return false;
    }

    FTakeOneSceneSpec Parsed;
    Parsed.SchemaVersion = StringOr(Root, TEXT("schema_version"), TEXT("1.0"));
    if (Parsed.SchemaVersion != TEXT("1.0"))
    {
        OutError = FString::Printf(TEXT("Unsupported scene schema version '%s'."), *Parsed.SchemaVersion);
        return false;
    }

    Parsed.Title = StringOr(Root, TEXT("title"), TEXT("Untitled generated scene")).Left(120);
    Parsed.Summary = StringOr(Root, TEXT("summary"), FString()).Left(500);

    if (const TSharedPtr<FJsonObject> Environment = ObjectOrNull(Root, TEXT("environment")))
    {
        Parsed.Environment.GroundColor = ReadColor(
            StringOr(Environment, TEXT("ground_color"), TEXT("#090A0C")),
            Parsed.Environment.GroundColor
        );
        Parsed.Environment.SkyLightColor = ReadColor(
            StringOr(Environment, TEXT("sky_light_color"), TEXT("#7394B8")),
            Parsed.Environment.SkyLightColor
        );
        Parsed.Environment.SkyLightIntensity = FMath::Clamp(
            static_cast<float>(NumberOr(Environment, TEXT("sky_light_intensity"), Parsed.Environment.SkyLightIntensity)),
            0.0f,
            20.0f
        );
        Parsed.Environment.SunColor = ReadColor(
            StringOr(Environment, TEXT("sun_color"), TEXT("#FFD1A6")),
            Parsed.Environment.SunColor
        );
        Parsed.Environment.SunIntensity = FMath::Clamp(
            static_cast<float>(NumberOr(Environment, TEXT("sun_intensity"), Parsed.Environment.SunIntensity)),
            0.0f,
            100.0f
        );
        Parsed.Environment.SunRotation = ReadRotator(
            ObjectOrNull(Environment, TEXT("sun_rotation")),
            Parsed.Environment.SunRotation
        );
        Parsed.Environment.FogDensity = FMath::Clamp(
            static_cast<float>(NumberOr(Environment, TEXT("fog_density"), Parsed.Environment.FogDensity)),
            0.0f,
            0.1f
        );
    }

    if (const TSharedPtr<FJsonObject> Camera = ObjectOrNull(Root, TEXT("camera")))
    {
        Parsed.Camera.Location = ReadVector(ObjectOrNull(Camera, TEXT("location")), Parsed.Camera.Location);
        Parsed.Camera.Rotation = ReadRotator(ObjectOrNull(Camera, TEXT("rotation")), Parsed.Camera.Rotation);
        Parsed.Camera.FieldOfView = FMath::Clamp(
            static_cast<float>(NumberOr(Camera, TEXT("fov"), Parsed.Camera.FieldOfView)),
            20.0f,
            120.0f
        );
    }

    const TArray<TSharedPtr<FJsonValue>>* Objects = nullptr;
    if (!Root->TryGetArrayField(TEXT("objects"), Objects) || !Objects)
    {
        OutError = TEXT("The generated scene has no 'objects' array.");
        return false;
    }

    const int32 ObjectCount = FMath::Min(Objects->Num(), MaxGeneratedObjects);
    Parsed.Objects.Reserve(ObjectCount);
    for (int32 Index = 0; Index < ObjectCount; ++Index)
    {
        const TSharedPtr<FJsonObject> Object = (*Objects)[Index]->AsObject();
        if (!Object.IsValid())
        {
            continue;
        }

        FTakeOneSceneObjectSpec Spec;
        const FString DefaultId = FString::Printf(TEXT("object_%03d"), Index);
        Spec.Id = FName(*StringOr(Object, TEXT("id"), DefaultId).Left(64));
        Spec.Label = StringOr(Object, TEXT("label"), Spec.Id.ToString()).Left(120);
        Spec.Primitive = ParsePrimitive(StringOr(Object, TEXT("primitive"), TEXT("cube")));
        Spec.Location = ReadVector(ObjectOrNull(Object, TEXT("location")), FVector::ZeroVector);
        Spec.Rotation = ReadRotator(ObjectOrNull(Object, TEXT("rotation")), FRotator::ZeroRotator);
        Spec.Scale = ReadVector(ObjectOrNull(Object, TEXT("scale")), FVector::OneVector);
        Spec.Scale.X = FMath::Clamp(FMath::Abs(Spec.Scale.X), 0.01, 100.0);
        Spec.Scale.Y = FMath::Clamp(FMath::Abs(Spec.Scale.Y), 0.01, 100.0);
        Spec.Scale.Z = FMath::Clamp(FMath::Abs(Spec.Scale.Z), 0.01, 100.0);
        Spec.Color = ReadColor(StringOr(Object, TEXT("color"), TEXT("#30343A")), Spec.Color);
        Object->TryGetBoolField(TEXT("cast_shadow"), Spec.bCastShadow);
        Spec.AssetHint = StringOr(Object, TEXT("asset_hint"), FString()).Left(300);
        Parsed.Objects.Add(MoveTemp(Spec));
    }

    if (Parsed.Objects.IsEmpty())
    {
        OutError = TEXT("The generated scene did not contain any valid objects.");
        return false;
    }

    OutScene = MoveTemp(Parsed);
    OutError.Reset();
    return true;
}

FVector FTakeOneSceneJson::ReadVector(const TSharedPtr<FJsonObject>& Object, const FVector& DefaultValue)
{
    return FVector(
        FMath::Clamp(NumberOr(Object, TEXT("x"), DefaultValue.X), -MaxSceneCoordinate, MaxSceneCoordinate),
        FMath::Clamp(NumberOr(Object, TEXT("y"), DefaultValue.Y), -MaxSceneCoordinate, MaxSceneCoordinate),
        FMath::Clamp(NumberOr(Object, TEXT("z"), DefaultValue.Z), -MaxSceneCoordinate, MaxSceneCoordinate)
    );
}

FRotator FTakeOneSceneJson::ReadRotator(const TSharedPtr<FJsonObject>& Object, const FRotator& DefaultValue)
{
    return FRotator(
        FMath::Clamp(NumberOr(Object, TEXT("pitch"), DefaultValue.Pitch), -3600.0, 3600.0),
        FMath::Clamp(NumberOr(Object, TEXT("yaw"), DefaultValue.Yaw), -3600.0, 3600.0),
        FMath::Clamp(NumberOr(Object, TEXT("roll"), DefaultValue.Roll), -3600.0, 3600.0)
    ).GetNormalized();
}

FLinearColor FTakeOneSceneJson::ReadColor(const FString& Hex, const FLinearColor& DefaultValue)
{
    FString Normalized = Hex;
    Normalized.RemoveFromStart(TEXT("#"));
    if (Normalized.Len() != 6 && Normalized.Len() != 8)
    {
        return DefaultValue;
    }

    return FLinearColor::FromSRGBColor(FColor::FromHex(Normalized));
}
