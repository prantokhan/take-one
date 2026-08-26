#include "TakeOneSceneGeneratorSubsystem.h"

#include "Dom/JsonObject.h"
#include "HttpModule.h"
#include "Misc/Crc.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TakeOne.h"
#include "TakeOneSceneGenerationSettings.h"
#include "TakeOneSceneJson.h"
#include "TimerManager.h"

namespace
{
FTakeOneSceneObjectSpec MakeObject(
    const TCHAR* Id,
    const TCHAR* Label,
    const ETakeOnePrimitiveType Primitive,
    const FVector& Location,
    const FVector& Scale,
    const FLinearColor& Color,
    const FRotator& Rotation = FRotator::ZeroRotator,
    const TCHAR* AssetHint = TEXT("")
)
{
    FTakeOneSceneObjectSpec Object;
    Object.Id = FName(Id);
    Object.Label = Label;
    Object.Primitive = Primitive;
    Object.Location = Location;
    Object.Rotation = Rotation;
    Object.Scale = Scale;
    Object.Color = Color;
    Object.AssetHint = AssetHint;
    return Object;
}

FLinearColor PromptAccent(const FString& Prompt)
{
    const uint32 Hash = FCrc::StrCrc32(*Prompt);
    return FLinearColor::MakeFromHSV8(static_cast<uint8>(Hash & 255), 165, 220);
}

void ConfigurePromptMood(FTakeOneSceneSpec& Scene, const FString& LowerPrompt)
{
    Scene.Environment.GroundColor = FLinearColor(0.055f, 0.06f, 0.065f);
    Scene.Environment.SkyLightColor = FLinearColor(0.46f, 0.55f, 0.68f);
    Scene.Environment.SunColor = FLinearColor(1.0f, 0.82f, 0.64f);
    Scene.Environment.SunIntensity = 5.0f;
    Scene.Environment.FogDensity = 0.007f;
    Scene.Camera.Location = FVector(-1650.0f, -1250.0f, 620.0f);
    Scene.Camera.Rotation = FRotator(-12.0f, 36.0f, 0.0f);
    Scene.Camera.FieldOfView = 52.0f;

    if (LowerPrompt.Contains(TEXT("night")) ||
        LowerPrompt.Contains(TEXT("dark")) ||
        LowerPrompt.Contains(TEXT("midnight")))
    {
        Scene.Environment.GroundColor = FLinearColor(0.012f, 0.017f, 0.025f);
        Scene.Environment.SkyLightColor = FLinearColor(0.08f, 0.16f, 0.34f);
        Scene.Environment.SunColor = FLinearColor(0.32f, 0.48f, 0.9f);
        Scene.Environment.SunIntensity = 1.6f;
        Scene.Environment.FogDensity = 0.018f;
    }

    if (LowerPrompt.Contains(TEXT("sunset")) ||
        LowerPrompt.Contains(TEXT("golden hour")) ||
        LowerPrompt.Contains(TEXT("dusk")))
    {
        Scene.Environment.GroundColor = FLinearColor(0.12f, 0.055f, 0.028f);
        Scene.Environment.SkyLightColor = FLinearColor(0.5f, 0.18f, 0.22f);
        Scene.Environment.SunColor = FLinearColor(1.0f, 0.28f, 0.06f);
        Scene.Environment.SunIntensity = 7.0f;
        Scene.Environment.SunRotation = FRotator(-9.0f, -48.0f, 0.0f);
    }

    if (LowerPrompt.Contains(TEXT("snow")) ||
        LowerPrompt.Contains(TEXT("ice")) ||
        LowerPrompt.Contains(TEXT("arctic")) ||
        LowerPrompt.Contains(TEXT("winter")))
    {
        Scene.Environment.GroundColor = FLinearColor(0.68f, 0.77f, 0.82f);
        Scene.Environment.SkyLightColor = FLinearColor(0.48f, 0.68f, 0.92f);
        Scene.Environment.SunColor = FLinearColor(0.72f, 0.82f, 1.0f);
        Scene.Environment.SunIntensity = 4.2f;
        Scene.Environment.FogDensity = 0.022f;
    }

    if (LowerPrompt.Contains(TEXT("desert")) ||
        LowerPrompt.Contains(TEXT("sand")) ||
        LowerPrompt.Contains(TEXT("dune")))
    {
        Scene.Environment.GroundColor = FLinearColor(0.42f, 0.22f, 0.08f);
        Scene.Environment.SkyLightColor = FLinearColor(0.72f, 0.46f, 0.25f);
        Scene.Environment.SunColor = FLinearColor(1.0f, 0.68f, 0.28f);
        Scene.Environment.SunIntensity = 9.0f;
        Scene.Environment.FogDensity = 0.01f;
    }

    if (LowerPrompt.Contains(TEXT("fog")) ||
        LowerPrompt.Contains(TEXT("mist")) ||
        LowerPrompt.Contains(TEXT("smoke")))
    {
        Scene.Environment.FogDensity = FMath::Max(Scene.Environment.FogDensity, 0.038f);
    }

    if (LowerPrompt.Contains(TEXT("red")))
    {
        Scene.Environment.SunColor = FLinearColor(1.0f, 0.12f, 0.06f);
    }
    else if (LowerPrompt.Contains(TEXT("purple")) || LowerPrompt.Contains(TEXT("violet")))
    {
        Scene.Environment.SunColor = FLinearColor(0.55f, 0.18f, 1.0f);
    }
    else if (LowerPrompt.Contains(TEXT("green")))
    {
        Scene.Environment.SunColor = FLinearColor(0.18f, 1.0f, 0.38f);
    }
}

void AddStationSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Night Platform");
    Scene.Summary = TEXT("A rain-dark railway platform with a strong central vanishing point.");
    Scene.Environment.GroundColor = FLinearColor(0.018f, 0.025f, 0.03f);
    Scene.Environment.SkyLightColor = FLinearColor(0.12f, 0.22f, 0.3f);
    Scene.Environment.SunColor = FLinearColor(0.42f, 0.58f, 0.72f);
    Scene.Environment.SunIntensity = 2.0f;
    Scene.Environment.FogDensity = 0.028f;
    Scene.Camera.Location = FVector(-1700.0f, -1500.0f, 500.0f);
    Scene.Camera.Rotation = FRotator(-9.0f, 39.0f, 0.0f);

    Scene.Objects.Add(MakeObject(
        TEXT("platform"), TEXT("Railway platform"), ETakeOnePrimitiveType::Cube,
        FVector(200.0f, 0.0f, 55.0f), FVector(30.0f, 5.0f, 1.1f),
        FLinearColor(0.12f, 0.14f, 0.15f), FRotator::ZeroRotator,
        TEXT("weathered 1980s concrete railway platform")
    ));
    Scene.Objects.Add(MakeObject(
        TEXT("station_wall"), TEXT("Station wall"), ETakeOnePrimitiveType::Cube,
        FVector(300.0f, 650.0f, 350.0f), FVector(27.0f, 0.5f, 7.0f),
        FLinearColor(0.16f, 0.19f, 0.19f), FRotator::ZeroRotator,
        TEXT("aged tiled railway station wall")
    ));

    for (int32 Index = -4; Index <= 4; ++Index)
    {
        const float X = static_cast<float>(Index) * 520.0f;
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("pillar_%d"), Index + 4), TEXT("Canopy pillar"),
            ETakeOnePrimitiveType::Cylinder, FVector(X, 470.0f, 330.0f),
            FVector(0.35f, 0.35f, 6.5f), FLinearColor(0.19f, 0.24f, 0.25f),
            FRotator::ZeroRotator, TEXT("painted iron station canopy pillar")
        ));
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("lamp_%d"), Index + 4), TEXT("Platform lamp"),
            ETakeOnePrimitiveType::Sphere,
            FVector(X, 390.0f, 590.0f + Random.FRandRange(-10.0f, 10.0f)),
            FVector(0.28f), FLinearColor(1.0f, 0.62f, 0.24f),
            FRotator::ZeroRotator, TEXT("warm tungsten station practical light")
        ));
    }
}

void AddForestSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Fog Forest Clearing");
    Scene.Summary = TEXT("A controllable forest clearing staged around an open performance area.");
    Scene.Environment.GroundColor = FLinearColor(0.025f, 0.06f, 0.035f);
    Scene.Environment.SkyLightColor = FLinearColor(0.18f, 0.35f, 0.28f);
    Scene.Environment.SunColor = FLinearColor(0.58f, 0.74f, 0.58f);
    Scene.Environment.SunIntensity = 4.0f;
    Scene.Environment.FogDensity = 0.035f;
    Scene.Camera.Location = FVector(-1500.0f, -1200.0f, 620.0f);
    Scene.Camera.Rotation = FRotator(-13.0f, 37.0f, 0.0f);

    for (int32 Index = 0; Index < 26; ++Index)
    {
        const float Angle = Random.FRandRange(0.0f, 2.0f * PI);
        const float Radius = Random.FRandRange(850.0f, 2600.0f);
        const float Height = Random.FRandRange(700.0f, 1500.0f);
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("tree_%02d"), Index), TEXT("Generated tree proxy"),
            ETakeOnePrimitiveType::Cylinder,
            FVector(FMath::Cos(Angle) * Radius, FMath::Sin(Angle) * Radius, Height * 0.5f),
            FVector(Random.FRandRange(0.5f, 1.1f), Random.FRandRange(0.5f, 1.1f), Height / 100.0f),
            FLinearColor(0.09f, 0.055f, 0.028f),
            FRotator(Random.FRandRange(-2.0f, 2.0f), Random.FRandRange(0.0f, 180.0f), 0.0f),
            TEXT("original mossy old-growth tree")
        ));
    }
}

void AddCitySet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Rain City Backlot");
    Scene.Summary = TEXT("A dense night street with controllable silhouettes and practical-light accents.");
    Scene.Environment.GroundColor = FLinearColor(0.015f, 0.018f, 0.025f);
    Scene.Environment.SkyLightColor = FLinearColor(0.11f, 0.18f, 0.35f);
    Scene.Environment.SunColor = FLinearColor(0.25f, 0.32f, 0.65f);
    Scene.Environment.SunIntensity = 1.5f;
    Scene.Environment.FogDensity = 0.018f;
    Scene.Camera.Location = FVector(-1800.0f, -950.0f, 480.0f);
    Scene.Camera.Rotation = FRotator(-8.0f, 28.0f, 0.0f);

    for (int32 Side = -1; Side <= 1; Side += 2)
    {
        for (int32 Index = 0; Index < 9; ++Index)
        {
            const float Height = Random.FRandRange(700.0f, 2100.0f);
            const float X = -1600.0f + Index * 450.0f;
            const float Y = static_cast<float>(Side) * Random.FRandRange(750.0f, 1050.0f);
            Scene.Objects.Add(MakeObject(
                *FString::Printf(TEXT("building_%d_%02d"), Side, Index),
                TEXT("Generated building proxy"), ETakeOnePrimitiveType::Cube,
                FVector(X, Y, Height * 0.5f),
                FVector(Random.FRandRange(3.0f, 5.0f), Random.FRandRange(4.0f, 7.0f), Height / 100.0f),
                Side < 0 ? FLinearColor(0.055f, 0.07f, 0.11f) : FLinearColor(0.08f, 0.055f, 0.11f),
                FRotator::ZeroRotator, TEXT("original rain-soaked urban building facade")
            ));
        }
    }
}

void AddSpaceSet(FTakeOneSceneSpec& Scene, FRandomStream& Random, const bool bMars)
{
    Scene.Title = bMars ? TEXT("Mars Frontier Outpost") : TEXT("Lunar Research Base");
    Scene.Environment.GroundColor = bMars
        ? FLinearColor(0.28f, 0.075f, 0.035f)
        : FLinearColor(0.11f, 0.12f, 0.14f);
    Scene.Environment.SkyLightColor = bMars
        ? FLinearColor(0.45f, 0.12f, 0.06f)
        : FLinearColor(0.12f, 0.18f, 0.38f);
    Scene.Environment.SunColor = FLinearColor(0.7f, 0.82f, 1.0f);
    Scene.Environment.SunIntensity = 6.5f;
    Scene.Environment.FogDensity = bMars ? 0.012f : 0.002f;

    for (int32 Index = 0; Index < 4; ++Index)
    {
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("habitat_%d"), Index), TEXT("Habitat dome"),
            ETakeOnePrimitiveType::Sphere,
            FVector(Index * 480.0f - 600.0f, Index % 2 == 0 ? 200.0f : -240.0f, 150.0f),
            FVector(3.0f, 3.0f, 1.5f), FLinearColor(0.32f, 0.38f, 0.46f),
            FRotator::ZeroRotator, TEXT("modular science habitat dome")
        ));
    }
    Scene.Objects.Add(MakeObject(
        TEXT("antenna"), TEXT("Communications tower"), ETakeOnePrimitiveType::Cylinder,
        FVector(900.0f, 500.0f, 600.0f), FVector(0.6f, 0.6f, 12.0f),
        FLinearColor(0.18f, 0.2f, 0.24f), FRotator::ZeroRotator,
        TEXT("deep-space communications mast")
    ));
    for (int32 Index = 0; Index < 14; ++Index)
    {
        const float Angle = Random.FRandRange(0.0f, 2.0f * PI);
        const float Radius = Random.FRandRange(700.0f, 2600.0f);
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("space_rock_%02d"), Index), TEXT("Crater rock"),
            ETakeOnePrimitiveType::Sphere,
            FVector(FMath::Cos(Angle) * Radius, FMath::Sin(Angle) * Radius, Random.FRandRange(25.0f, 100.0f)),
            FVector(Random.FRandRange(0.4f, 2.2f), Random.FRandRange(0.5f, 2.5f), Random.FRandRange(0.25f, 1.1f)),
            bMars ? FLinearColor(0.22f, 0.06f, 0.025f) : FLinearColor(0.09f, 0.1f, 0.12f),
            FRotator(Random.FRandRange(0.0f, 45.0f), Random.FRandRange(0.0f, 180.0f), 0.0f),
            TEXT("procedural planetary rock")
        ));
    }
}

void AddCastleSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Medieval Castle Courtyard");
    Scene.Environment.GroundColor = FLinearColor(0.11f, 0.095f, 0.075f);
    Scene.Environment.SkyLightColor = FLinearColor(0.32f, 0.4f, 0.48f);
    Scene.Environment.FogDensity = 0.014f;

    Scene.Objects.Add(MakeObject(
        TEXT("castle_wall"), TEXT("Castle wall"), ETakeOnePrimitiveType::Cube,
        FVector(700.0f, 0.0f, 500.0f), FVector(1.0f, 24.0f, 10.0f),
        FLinearColor(0.22f, 0.2f, 0.17f), FRotator::ZeroRotator,
        TEXT("weathered medieval stone curtain wall")
    ));
    for (int32 Side = -1; Side <= 1; Side += 2)
    {
        Scene.Objects.Add(MakeObject(
            Side < 0 ? TEXT("tower_left") : TEXT("tower_right"), TEXT("Castle tower"),
            ETakeOnePrimitiveType::Cylinder, FVector(620.0f, Side * 1250.0f, 650.0f),
            FVector(3.6f, 3.6f, 13.0f), FLinearColor(0.2f, 0.18f, 0.15f),
            FRotator::ZeroRotator, TEXT("round medieval defensive tower")
        ));
    }
    Scene.Objects.Add(MakeObject(
        TEXT("gate"), TEXT("Main gate"), ETakeOnePrimitiveType::Cube,
        FVector(610.0f, 0.0f, 230.0f), FVector(1.2f, 3.2f, 4.6f),
        FLinearColor(0.08f, 0.04f, 0.018f), FRotator::ZeroRotator,
        TEXT("massive timber castle gate")
    ));
    for (int32 Index = 0; Index < 10; ++Index)
    {
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("courtyard_prop_%02d"), Index), TEXT("Courtyard prop"),
            Index % 3 == 0 ? ETakeOnePrimitiveType::Cylinder : ETakeOnePrimitiveType::Cube,
            FVector(Random.FRandRange(-500.0f, 450.0f), Random.FRandRange(-950.0f, 950.0f), 70.0f),
            FVector(Random.FRandRange(0.5f, 1.8f)), FLinearColor(0.17f, 0.09f, 0.035f),
            FRotator(0.0f, Random.FRandRange(0.0f, 180.0f), 0.0f),
            TEXT("medieval courtyard barrel crate or market prop")
        ));
    }
}

void AddInteriorSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Generated Interior Set");
    Scene.Environment.GroundColor = FLinearColor(0.13f, 0.09f, 0.06f);
    Scene.Environment.SkyLightColor = FLinearColor(0.32f, 0.24f, 0.18f);
    Scene.Environment.SunColor = FLinearColor(1.0f, 0.55f, 0.22f);
    Scene.Environment.SunIntensity = 3.0f;
    Scene.Camera.Location = FVector(-1200.0f, -900.0f, 440.0f);
    Scene.Camera.Rotation = FRotator(-9.0f, 35.0f, 0.0f);

    Scene.Objects.Add(MakeObject(
        TEXT("rear_wall"), TEXT("Interior rear wall"), ETakeOnePrimitiveType::Cube,
        FVector(650.0f, 0.0f, 350.0f), FVector(0.5f, 14.0f, 7.0f),
        FLinearColor(0.34f, 0.28f, 0.22f), FRotator::ZeroRotator,
        TEXT("production-ready interior wall with practical dressing")
    ));
    Scene.Objects.Add(MakeObject(
        TEXT("side_wall"), TEXT("Interior side wall"), ETakeOnePrimitiveType::Cube,
        FVector(0.0f, 700.0f, 350.0f), FVector(13.0f, 0.5f, 7.0f),
        FLinearColor(0.3f, 0.25f, 0.2f), FRotator::ZeroRotator,
        TEXT("removable film-set interior wall")
    ));
    Scene.Objects.Add(MakeObject(
        TEXT("hero_table"), TEXT("Hero table"), ETakeOnePrimitiveType::Cube,
        FVector(0.0f, 0.0f, 90.0f), FVector(3.2f, 1.8f, 0.18f),
        FLinearColor(0.28f, 0.11f, 0.035f), FRotator::ZeroRotator,
        TEXT("dressed practical hero table")
    ));
    for (int32 Index = 0; Index < 10; ++Index)
    {
        const float Angle = (2.0f * PI * Index) / 10.0f;
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("furniture_%02d"), Index), TEXT("Interior furniture"),
            Index % 4 == 0 ? ETakeOnePrimitiveType::Cylinder : ETakeOnePrimitiveType::Cube,
            FVector(FMath::Cos(Angle) * Random.FRandRange(350.0f, 850.0f),
                FMath::Sin(Angle) * Random.FRandRange(350.0f, 650.0f),
                Random.FRandRange(55.0f, 150.0f)),
            FVector(Random.FRandRange(0.7f, 2.2f), Random.FRandRange(0.7f, 1.8f), Random.FRandRange(0.5f, 2.2f)),
            FLinearColor(0.18f, 0.1f, 0.05f),
            FRotator(0.0f, Random.FRandRange(0.0f, 180.0f), 0.0f),
            TEXT("prompt-matched interior furniture or practical prop")
        ));
    }
}

void AddIndustrialSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Industrial Production Floor");
    Scene.Environment.GroundColor = FLinearColor(0.045f, 0.05f, 0.052f);
    Scene.Environment.SkyLightColor = FLinearColor(0.22f, 0.3f, 0.34f);
    Scene.Environment.FogDensity = 0.018f;
    for (int32 Index = 0; Index < 18; ++Index)
    {
        const bool bPipe = Index % 3 == 0;
        const float Height = bPipe ? Random.FRandRange(350.0f, 900.0f) : Random.FRandRange(100.0f, 420.0f);
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("industrial_%02d"), Index),
            bPipe ? TEXT("Industrial pipe") : TEXT("Industrial machinery"),
            bPipe ? ETakeOnePrimitiveType::Cylinder : ETakeOnePrimitiveType::Cube,
            FVector(Random.FRandRange(-800.0f, 1500.0f), Random.FRandRange(-1100.0f, 1100.0f), Height * 0.5f),
            FVector(Random.FRandRange(0.5f, 3.5f), Random.FRandRange(0.5f, 3.5f), Height / 100.0f),
            bPipe ? FLinearColor(0.18f, 0.2f, 0.19f) : FLinearColor(0.12f, 0.14f, 0.15f),
            FRotator(0.0f, Random.FRandRange(0.0f, 180.0f), 0.0f),
            bPipe ? TEXT("aged industrial pipe assembly") : TEXT("prompt-specific factory machinery proxy")
        ));
    }
}

void AddCoastalSet(FTakeOneSceneSpec& Scene, FRandomStream& Random)
{
    Scene.Title = TEXT("Coastal Film Set");
    Scene.Environment.GroundColor = FLinearColor(0.48f, 0.34f, 0.17f);
    Scene.Environment.SkyLightColor = FLinearColor(0.22f, 0.62f, 0.82f);
    Scene.Environment.SunColor = FLinearColor(1.0f, 0.78f, 0.42f);
    Scene.Environment.SunIntensity = 8.0f;
    Scene.Objects.Add(MakeObject(
        TEXT("ocean"), TEXT("Ocean surface"), ETakeOnePrimitiveType::Cube,
        FVector(1400.0f, 0.0f, 5.0f), FVector(20.0f, 35.0f, 0.05f),
        FLinearColor(0.025f, 0.22f, 0.38f), FRotator::ZeroRotator,
        TEXT("cinematic ocean water surface")
    ));
    for (int32 Index = 0; Index < 12; ++Index)
    {
        const float X = Random.FRandRange(-900.0f, 800.0f);
        const float Y = Random.FRandRange(-1500.0f, 1500.0f);
        const bool bPalm = Index % 2 == 0;
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("coastal_prop_%02d"), Index),
            bPalm ? TEXT("Palm tree") : TEXT("Coastal rock"),
            bPalm ? ETakeOnePrimitiveType::Cylinder : ETakeOnePrimitiveType::Sphere,
            FVector(X, Y, bPalm ? 340.0f : 70.0f),
            bPalm ? FVector(0.55f, 0.55f, 6.8f) : FVector(Random.FRandRange(0.8f, 2.6f)),
            bPalm ? FLinearColor(0.12f, 0.065f, 0.025f) : FLinearColor(0.16f, 0.14f, 0.12f),
            FRotator(0.0f, Random.FRandRange(0.0f, 180.0f), 0.0f),
            bPalm ? TEXT("windswept tropical palm tree") : TEXT("weathered coastal rock")
        ));
    }
}

void AddGenericPromptSet(FTakeOneSceneSpec& Scene, FRandomStream& Random, const FString& Prompt)
{
    const FLinearColor Accent = PromptAccent(Prompt);
    const uint32 Hash = FCrc::StrCrc32(*Prompt);
    FString ShortPrompt = Prompt.Left(44);
    ShortPrompt.TrimStartAndEndInline();
    Scene.Title = FString::Printf(TEXT("Director Set: %s"), *ShortPrompt);

    Scene.Objects.Add(MakeObject(
        TEXT("hero_subject"), TEXT("Prompt hero subject"),
        static_cast<ETakeOnePrimitiveType>(Hash % 4), FVector(120.0f, 0.0f, 180.0f),
        FVector(2.8f, 2.8f, 3.6f), Accent, FRotator::ZeroRotator, *Prompt
    ));

    for (int32 Index = 0; Index < 16; ++Index)
    {
        const float Angle = (2.0f * PI * Index) / 16.0f + Random.FRandRange(-0.18f, 0.18f);
        const float Radius = Random.FRandRange(500.0f, 1900.0f);
        const float Height = Random.FRandRange(100.0f, 850.0f);
        const ETakeOnePrimitiveType Primitive = static_cast<ETakeOnePrimitiveType>((Hash + Index) % 4);
        const FLinearColor Color(
            FMath::Clamp(Accent.R * Random.FRandRange(0.32f, 0.82f), 0.025f, 0.9f),
            FMath::Clamp(Accent.G * Random.FRandRange(0.32f, 0.82f), 0.025f, 0.9f),
            FMath::Clamp(Accent.B * Random.FRandRange(0.32f, 0.82f), 0.025f, 0.9f)
        );
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("prompt_element_%02d"), Index), TEXT("Prompt-derived set element"),
            Primitive,
            FVector(FMath::Cos(Angle) * Radius + 250.0f, FMath::Sin(Angle) * Radius, Height * 0.5f),
            FVector(Random.FRandRange(0.7f, 4.0f), Random.FRandRange(0.7f, 4.0f), Height / 100.0f),
            Color, FRotator(0.0f, Random.FRandRange(0.0f, 180.0f), 0.0f), *Prompt
        ));
    }
}

void AddPromptDrivenSet(
    FTakeOneSceneSpec& Scene,
    FRandomStream& Random,
    const FString& Prompt,
    const FString& LowerPrompt
)
{
    ConfigurePromptMood(Scene, LowerPrompt);
    Scene.Summary = FString::Printf(TEXT("Offline prompt-responsive layout for: %s"), *Prompt.Left(180));

    if (LowerPrompt.Contains(TEXT("space")) ||
        LowerPrompt.Contains(TEXT("moon")) ||
        LowerPrompt.Contains(TEXT("lunar")) ||
        LowerPrompt.Contains(TEXT("mars")) ||
        LowerPrompt.Contains(TEXT("planet")) ||
        LowerPrompt.Contains(TEXT("alien")))
    {
        AddSpaceSet(Scene, Random, LowerPrompt.Contains(TEXT("mars")));
    }
    else if (LowerPrompt.Contains(TEXT("castle")) ||
        LowerPrompt.Contains(TEXT("medieval")) ||
        LowerPrompt.Contains(TEXT("fortress")) ||
        LowerPrompt.Contains(TEXT("palace")))
    {
        AddCastleSet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("room")) ||
        LowerPrompt.Contains(TEXT("interior")) ||
        LowerPrompt.Contains(TEXT("apartment")) ||
        LowerPrompt.Contains(TEXT("house")) ||
        LowerPrompt.Contains(TEXT("office")) ||
        LowerPrompt.Contains(TEXT("restaurant")) ||
        LowerPrompt.Contains(TEXT("cafe")))
    {
        AddInteriorSet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("factory")) ||
        LowerPrompt.Contains(TEXT("warehouse")) ||
        LowerPrompt.Contains(TEXT("industrial")) ||
        LowerPrompt.Contains(TEXT("laboratory")) ||
        LowerPrompt.Contains(TEXT("lab")))
    {
        AddIndustrialSet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("beach")) ||
        LowerPrompt.Contains(TEXT("ocean")) ||
        LowerPrompt.Contains(TEXT("island")) ||
        LowerPrompt.Contains(TEXT("coast")) ||
        LowerPrompt.Contains(TEXT("sea")))
    {
        AddCoastalSet(Scene, Random);
    }
    else
    {
        AddGenericPromptSet(Scene, Random, Prompt);
    }
}

void AddStudioSet(FTakeOneSceneSpec& Scene)
{
    Scene.Title = TEXT("Generated Soundstage");
    Scene.Summary = TEXT("A neutral soundstage generated as a safe starting point for directing.");
    Scene.Environment.GroundColor = FLinearColor(0.035f, 0.038f, 0.045f);
    Scene.Environment.SkyLightColor = FLinearColor(0.4f, 0.48f, 0.58f);
    Scene.Environment.SunIntensity = 5.0f;
    Scene.Environment.FogDensity = 0.006f;

    Scene.Objects.Add(MakeObject(
        TEXT("backdrop"), TEXT("Cyclorama backdrop"), ETakeOnePrimitiveType::Cube,
        FVector(700.0f, 0.0f, 500.0f), FVector(0.5f, 20.0f, 10.0f),
        FLinearColor(0.14f, 0.15f, 0.17f), FRotator::ZeroRotator,
        TEXT("large neutral virtual-production cyclorama")
    ));
    Scene.Objects.Add(MakeObject(
        TEXT("hero_table"), TEXT("Hero prop table"), ETakeOnePrimitiveType::Cube,
        FVector(0.0f, 0.0f, 90.0f), FVector(3.2f, 1.6f, 0.18f),
        FLinearColor(0.24f, 0.12f, 0.06f), FRotator::ZeroRotator,
        TEXT("original practical wooden hero table")
    ));
    for (int32 Index = 0; Index < 4; ++Index)
    {
        const float Y = Index % 2 == 0 ? -650.0f : 650.0f;
        const float X = Index < 2 ? -450.0f : 450.0f;
        Scene.Objects.Add(MakeObject(
            *FString::Printf(TEXT("light_stand_%d"), Index), TEXT("Light stand"),
            ETakeOnePrimitiveType::Cylinder, FVector(X, Y, 300.0f),
            FVector(0.12f, 0.12f, 6.0f), FLinearColor(0.06f, 0.06f, 0.065f),
            FRotator::ZeroRotator, TEXT("film set light stand")
        ));
    }
}

FTakeOneSceneSpec BuildMockSpec(const FString& Prompt)
{
    FTakeOneSceneSpec Scene;
    FRandomStream Random(static_cast<int32>(FCrc::StrCrc32(*Prompt)));
    const FString LowerPrompt = Prompt.ToLower();

    if (LowerPrompt.Contains(TEXT("station")) ||
        LowerPrompt.Contains(TEXT("train")) ||
        LowerPrompt.Contains(TEXT("railway")))
    {
        AddStationSet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("forest")) ||
        LowerPrompt.Contains(TEXT("woods")) ||
        LowerPrompt.Contains(TEXT("jungle")))
    {
        AddForestSet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("city")) ||
        LowerPrompt.Contains(TEXT("alley")) ||
        LowerPrompt.Contains(TEXT("street")))
    {
        AddCitySet(Scene, Random);
    }
    else if (LowerPrompt.Contains(TEXT("soundstage")) ||
        LowerPrompt.Contains(TEXT("studio")) ||
        LowerPrompt.Contains(TEXT("cyclorama")))
    {
        AddStudioSet(Scene);
    }
    else
    {
        AddPromptDrivenSet(Scene, Random, Prompt, LowerPrompt);
    }

    return Scene;
}
}

void UTakeOneSceneGeneratorSubsystem::GenerateScene(const FString& Prompt)
{
    const FString CleanPrompt = Prompt.TrimStartAndEnd();
    if (CleanPrompt.Len() < 3)
    {
        OnGenerationFailed.Broadcast(TEXT("Describe the set in at least three characters."));
        return;
    }

    if (bIsGenerating)
    {
        OnGenerationFailed.Broadcast(TEXT("A scene is already being generated."));
        return;
    }

    bIsGenerating = true;
    PendingPrompt = CleanPrompt.Left(4000);
    OnGenerationStarted.Broadcast(PendingPrompt);

    const UTakeOneSceneGenerationSettings* Settings = GetDefault<UTakeOneSceneGenerationSettings>();
    if (Settings->bUseMockGenerator)
    {
        GenerateMockScene(PendingPrompt, false);
        return;
    }

    if (Settings->ServiceUrl.IsEmpty())
    {
        if (Settings->bFallbackToMockOnError)
        {
            GenerateMockScene(PendingPrompt, true);
        }
        else
        {
            FailGeneration(TEXT("No scene-generation service URL is configured."));
        }
        return;
    }

    ActiveRequest = FHttpModule::Get().CreateRequest();
    ActiveRequest->SetURL(Settings->ServiceUrl);
    ActiveRequest->SetVerb(TEXT("POST"));
    ActiveRequest->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    ActiveRequest->SetHeader(TEXT("Accept"), TEXT("application/json"));
    ActiveRequest->SetTimeout(Settings->RequestTimeoutSeconds);

    if (!Settings->ServiceTokenEnvironmentVariable.IsEmpty())
    {
        const FString ServiceToken = FPlatformMisc::GetEnvironmentVariable(*Settings->ServiceTokenEnvironmentVariable);
        if (!ServiceToken.IsEmpty())
        {
            ActiveRequest->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *ServiceToken));
        }
    }

    ActiveRequest->SetContentAsString(FTakeOneSceneJson::SerializeGenerationRequest(PendingPrompt));
    ActiveRequest->OnProcessRequestComplete().BindUObject(
        this,
        &UTakeOneSceneGeneratorSubsystem::HandleHttpComplete
    );

    if (!ActiveRequest->ProcessRequest())
    {
        ActiveRequest.Reset();
        if (Settings->bFallbackToMockOnError)
        {
            GenerateMockScene(PendingPrompt, true);
        }
        else
        {
            FailGeneration(TEXT("The scene-generation request could not be started."));
        }
    }
}

void UTakeOneSceneGeneratorSubsystem::GenerateMockScene(const FString& Prompt, const bool bIsFallback)
{
    if (!GetWorld())
    {
        FailGeneration(TEXT("No game world is available for scene generation."));
        return;
    }

    GetWorld()->GetTimerManager().SetTimerForNextTick(
        FTimerDelegate::CreateWeakLambda(this, [this, Prompt, bIsFallback]()
        {
            FTakeOneSceneSpec Scene = BuildMockSpec(Prompt);
            UE_LOG(
                LogTakeOne,
                Log,
                TEXT("Offline generator interpreted '%s' as '%s' with %d objects."),
                *Prompt.Left(120),
                *Scene.Title,
                Scene.Objects.Num()
            );
            bIsGenerating = false;
            PendingPrompt.Reset();
            OnGenerationCompleted.Broadcast(Scene, true);

            if (bIsFallback)
            {
                UE_LOG(LogTakeOne, Warning, TEXT("Scene service unavailable; used deterministic mock generation."));
            }
        })
    );
}

void UTakeOneSceneGeneratorSubsystem::HandleHttpComplete(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    const bool bWasSuccessful
)
{
    ActiveRequest.Reset();
    const UTakeOneSceneGenerationSettings* Settings = GetDefault<UTakeOneSceneGenerationSettings>();

    if (!bWasSuccessful || !Response.IsValid() || !EHttpResponseCodes::IsOk(Response->GetResponseCode()))
    {
        const int32 ResponseCode = Response.IsValid() ? Response->GetResponseCode() : 0;
        const FString Error = FString::Printf(TEXT("Scene service request failed (HTTP %d)."), ResponseCode);
        if (Settings->bFallbackToMockOnError)
        {
            UE_LOG(LogTakeOne, Warning, TEXT("%s Falling back to mock generation."), *Error);
            GenerateMockScene(PendingPrompt, true);
        }
        else
        {
            FailGeneration(Error);
        }
        return;
    }

    FTakeOneSceneSpec Scene;
    FString ParseError;
    if (!FTakeOneSceneJson::DeserializeScene(Response->GetContentAsString(), Scene, ParseError))
    {
        if (Settings->bFallbackToMockOnError)
        {
            UE_LOG(LogTakeOne, Warning, TEXT("%s Falling back to mock generation."), *ParseError);
            GenerateMockScene(PendingPrompt, true);
        }
        else
        {
            FailGeneration(ParseError);
        }
        return;
    }

    bIsGenerating = false;
    PendingPrompt.Reset();
    OnGenerationCompleted.Broadcast(Scene, false);
}

void UTakeOneSceneGeneratorSubsystem::FailGeneration(const FString& Error)
{
    bIsGenerating = false;
    PendingPrompt.Reset();
    ActiveRequest.Reset();
    UE_LOG(LogTakeOne, Error, TEXT("%s"), *Error);
    OnGenerationFailed.Broadcast(Error);
}

void UTakeOneSceneGeneratorSubsystem::StartRemoteJobPolling()
{
    if (bRemotePollingStarted || !GetWorld())
    {
        return;
    }

    const UTakeOneSceneGenerationSettings* Settings = GetDefault<UTakeOneSceneGenerationSettings>();
    if (!Settings->bConsumeRemoteJobs || Settings->ServiceUrl.IsEmpty())
    {
        return;
    }

    // Derive the adapter root from the configured scene endpoint:
    // http://host:port/v1/scenes/generate -> http://host:port/v1
    FString BaseUrl = Settings->ServiceUrl;
    int32 LastSlashIndex = INDEX_NONE;
    if (BaseUrl.FindLastChar(TEXT('/'), LastSlashIndex))
    {
        BaseUrl = BaseUrl.Left(LastSlashIndex);
    }
    if (BaseUrl.EndsWith(TEXT("/scenes")))
    {
        BaseUrl = BaseUrl.LeftChop(7);
    }
    RemoteJobsUrl = BaseUrl + TEXT("/jobs/next?consumer=unreal");

    bRemotePollingStarted = true;
    GetWorld()->GetTimerManager().SetTimer(
        RemotePollTimerHandle,
        FTimerDelegate::CreateUObject(this, &UTakeOneSceneGeneratorSubsystem::PollRemoteJobs),
        2.5f,
        true
    );
    UE_LOG(LogTakeOne, Log, TEXT("Remote job polling started: %s"), *RemoteJobsUrl);
}

void UTakeOneSceneGeneratorSubsystem::PollRemoteJobs()
{
    if (!GetWorld() || ActiveRequest.IsValid() || RemoteJobsUrl.IsEmpty())
    {
        return;
    }

    FHttpRequestPtr Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(RemoteJobsUrl);
    Request->SetVerb(TEXT("GET"));
    Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
    Request->SetTimeout(4.0f);
    Request->OnProcessRequestComplete().BindUObject(this, &UTakeOneSceneGeneratorSubsystem::HandlePollComplete);

    FHttpRequestPtr CapturedRequest = Request;
    ActiveRequest = Request;
    if (!Request->ProcessRequest())
    {
        ActiveRequest.Reset();
    }
}

void UTakeOneSceneGeneratorSubsystem::HandlePollComplete(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    const bool bWasSuccessful
)
{
    ActiveRequest.Reset();

    if (!bWasSuccessful || !Response.IsValid() || !EHttpResponseCodes::IsOk(Response->GetResponseCode()))
    {
        return; // Adapter offline or busy — the next tick retries silently.
    }

    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        return;
    }

    const TSharedPtr<FJsonValue> JobValue = Root->TryGetField(TEXT("job"));
    if (!JobValue.IsValid() || JobValue->Type != EJson::Object)
    {
        return; // Queue empty.
    }

    const TSharedPtr<FJsonObject> Job = JobValue->AsObject();
    const TSharedPtr<FJsonValue> SceneValue = Job.IsValid() ? Job->TryGetField(TEXT("scene")) : nullptr;
    if (!SceneValue.IsValid() || SceneValue->Type != EJson::Object)
    {
        return;
    }

    // Carry the web game's film identity so stills shot here land on the
    // right production in the catalog.
    ActiveFilmId = Job->GetStringField(TEXT("film_id"));
    if (ActiveFilmId.IsEmpty())
    {
        ActiveFilmId = TEXT("freeshoot");
    }
    ActiveCastCount = static_cast<int32>(Job->GetIntegerField(TEXT("cast_count")));

    FString SceneJsonText;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&SceneJsonText);
    if (!FJsonSerializer::Serialize(SceneValue->AsObject().ToSharedRef(), Writer))
    {
        return;
    }

    FTakeOneSceneSpec Scene;
    FString ParseError;
    if (!FTakeOneSceneJson::DeserializeScene(SceneJsonText, Scene, ParseError))
    {
        UE_LOG(LogTakeOne, Warning, TEXT("Rejected remote job scene: %s"), *ParseError);
        return;
    }

    UE_LOG(
        LogTakeOne,
        Log,
        TEXT("Built remote job '%s' (%d objects)."),
        *Job->GetStringField(TEXT("id")),
        Scene.Objects.Num()
    );
    OnGenerationCompleted.Broadcast(Scene, false);
}
