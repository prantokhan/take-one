#pragma once

#include "CoreMinimal.h"
#include "TakeOneSceneTypes.generated.h"

UENUM(BlueprintType)
enum class ETakeOnePrimitiveType : uint8
{
    Cube,
    Sphere,
    Cylinder,
    Cone
};

USTRUCT(BlueprintType)
struct FTakeOneSceneObjectSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FName Id = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FString Label;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    ETakeOnePrimitiveType Primitive = ETakeOnePrimitiveType::Cube;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FVector Location = FVector::ZeroVector;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FRotator Rotation = FRotator::ZeroRotator;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FVector Scale = FVector::OneVector;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FLinearColor Color = FLinearColor(0.18f, 0.2f, 0.22f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    bool bCastShadow = true;

    // A semantic hint for a later text/image-to-3D asset service. The vertical
    // slice uses a primitive proxy until that asset is available.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FString AssetHint;
};

USTRUCT(BlueprintType)
struct FTakeOneEnvironmentSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment")
    FLinearColor GroundColor = FLinearColor(0.035f, 0.04f, 0.045f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment")
    FLinearColor SkyLightColor = FLinearColor(0.45f, 0.58f, 0.72f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment", meta = (ClampMin = "0.0", ClampMax = "20.0"))
    float SkyLightIntensity = 0.8f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment")
    FLinearColor SunColor = FLinearColor(1.0f, 0.82f, 0.65f, 1.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment", meta = (ClampMin = "0.0", ClampMax = "100.0"))
    float SunIntensity = 6.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment")
    FRotator SunRotation = FRotator(-35.0f, -35.0f, 0.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Environment", meta = (ClampMin = "0.0", ClampMax = "0.1"))
    float FogDensity = 0.012f;
};

USTRUCT(BlueprintType)
struct FTakeOneCameraSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
    FVector Location = FVector(-1400.0f, -900.0f, 550.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
    FRotator Rotation = FRotator(-12.0f, 32.0f, 0.0f);

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (ClampMin = "20.0", ClampMax = "120.0"))
    float FieldOfView = 50.0f;
};

USTRUCT(BlueprintType)
struct FTakeOneSceneSpec
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FString SchemaVersion = TEXT("1.0");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FString Title;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FString Summary;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FTakeOneEnvironmentSpec Environment;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    FTakeOneCameraSpec Camera;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Scene")
    TArray<FTakeOneSceneObjectSpec> Objects;
};
