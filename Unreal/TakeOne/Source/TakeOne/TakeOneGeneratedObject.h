#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TakeOneSceneTypes.h"
#include "TakeOneGeneratedObject.generated.h"

class UMaterialInstanceDynamic;
class UStaticMeshComponent;

UCLASS(BlueprintType)
class TAKEONE_API ATakeOneGeneratedObject : public AActor
{
    GENERATED_BODY()

public:
    ATakeOneGeneratedObject();

    void InitializeFromSpec(const FTakeOneSceneObjectSpec& Spec);

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Generated Object")
    TObjectPtr<UStaticMeshComponent> MeshComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Generated Object")
    FTakeOneSceneObjectSpec SourceSpec;

private:
    UPROPERTY(Transient)
    TObjectPtr<UMaterialInstanceDynamic> DynamicMaterial;
};
