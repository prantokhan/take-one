#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TakeOnePerformer.generated.h"

class USceneComponent;
class UStaticMeshComponent;
class UMaterialInstanceDynamic;

// A performer proxy: original AI-era "first team" standing in the generated
// set. Silhouette-first (torso + head) with procedural idle performance so
// shot stills and moving masters show people on set.
UCLASS(BlueprintType)
class TAKEONE_API ATakeOnePerformer : public AActor
{
    GENERATED_BODY()

public:
    ATakeOnePerformer();

    // Places and colors the performer; PhaseOffset desyncs idle motion
    // between performers in the same setup.
    void InitializeFromSetup(
        const FVector& Location,
        const FRotator& Facing,
        const FLinearColor& CostumeColor,
        const float PhaseOffset,
        const FString& DisplayName
    );

    virtual void Tick(float DeltaSeconds) override;

private:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USceneComponent> Root;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> TorsoMesh;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> HeadMesh;

    UPROPERTY(Transient)
    TObjectPtr<UMaterialInstanceDynamic> TorsoMaterial;

    float IdlePhase = 0.0f;
    FVector BaseLocation = FVector::ZeroVector;
};
