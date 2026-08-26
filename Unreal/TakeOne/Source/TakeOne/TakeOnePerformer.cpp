#include "TakeOnePerformer.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

ATakeOnePerformer::ATakeOnePerformer()
{
    PrimaryActorTick.bCanEverTick = true;

    Root = CreateDefaultSubobject<USceneComponent>(TEXT("PerformerRoot"));
    SetRootComponent(Root);

    TorsoMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Torso"));
    TorsoMesh->SetupAttachment(Root);
    TorsoMesh->SetMobility(EComponentMobility::Movable);
    TorsoMesh->SetCollisionProfileName(TEXT("BlockAll"));

    HeadMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Head"));
    HeadMesh->SetupAttachment(TorsoMesh);
    HeadMesh->SetMobility(EComponentMobility::Movable);
    HeadMesh->SetCollisionProfileName(TEXT("BlockAll"));

    Tags.Add(TEXT("TakeOne.Generated"));
}

void ATakeOnePerformer::InitializeFromSetup(
    const FVector& Location,
    const FRotator& Facing,
    const FLinearColor& CostumeColor,
    const float PhaseOffset,
    const FString& DisplayName
)
{
    if (UStaticMesh* TorsoMeshAsset = LoadObject<UStaticMesh>(
        nullptr,
        TEXT("/Engine/BasicShapes/Cylinder.Cylinder")
    ))
    {
        TorsoMesh->SetStaticMesh(TorsoMeshAsset);
    }
    if (UStaticMesh* HeadMeshAsset = LoadObject<UStaticMesh>(
        nullptr,
        TEXT("/Engine/BasicShapes/Sphere.Sphere")
    ))
    {
        HeadMesh->SetStaticMesh(HeadMeshAsset);
    }

    // Cylinder basic asset is 100uu tall and 100uu across; scale to a
    // human-ish silhouette.
    TorsoMesh->SetWorldScale3D(FVector(42.0f, 30.0f, 1.65f));
    TorsoMesh->SetRelativeLocation(FVector(0.0f, 0.0f, 82.5f));

    HeadMesh->SetWorldScale3D(FVector(0.42f, 0.38f, 0.44f));
    HeadMesh->SetRelativeLocation(FVector(0.0f, 0.0f, 62.0f));

    if (UMaterialInterface* BaseMaterial = LoadObject<UMaterialInterface>(
        nullptr,
        TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")
    ))
    {
        TorsoMaterial = UMaterialInstanceDynamic::Create(BaseMaterial, this);
        const FLinearColor SkinColor = FLinearColor(0.87f, 0.71f, 0.58f, 1.0f);
        if (TorsoMaterial)
        {
            TorsoMaterial->SetVectorParameterValue(TEXT("Color"), CostumeColor);
            TorsoMaterial->SetVectorParameterValue(TEXT("BaseColor"), CostumeColor);
            TorsoMesh->SetMaterial(0, TorsoMaterial);

            UMaterialInstanceDynamic* HeadMaterial = UMaterialInstanceDynamic::Create(BaseMaterial, this);
            if (HeadMaterial)
            {
                HeadMaterial->SetVectorParameterValue(TEXT("Color"), SkinColor);
                HeadMaterial->SetVectorParameterValue(TEXT("BaseColor"), SkinColor);
                HeadMesh->SetMaterial(0, HeadMaterial);
            }
        }
    }

    BaseLocation = Location;
    IdlePhase = PhaseOffset;
    SetActorLocationAndRotation(Location, Facing);

#if WITH_EDITOR
    SetActorLabel(DisplayName.IsEmpty() ? TEXT("Performer") : DisplayName);
#endif
}

void ATakeOnePerformer::Tick(const float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    const float Time = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0f;
    const float Sway = FMath::Sin(Time * 0.9f + IdlePhase) * 2.5f;
    const float Breath = FMath::Sin(Time * 1.7f + IdlePhase) * 2.0f;

    SetActorLocation(BaseLocation + FVector(0.0f, 0.0f, Breath));
    SetActorRotation(GetActorRotation().Add(0.0f, Sway * DeltaSeconds, 0.0f));
}
