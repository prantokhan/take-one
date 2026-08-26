#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TakeOneSceneTypes.h"
#include "TakeOneSceneBuilder.generated.h"

class ACineCameraActor;
class ATakeOnePerformer;
class USceneComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FTakeOneSceneBuilt,
    const FTakeOneSceneSpec&,
    Scene,
    int32,
    SpawnedObjectCount
);

UCLASS(BlueprintType)
class TAKEONE_API ATakeOneSceneBuilder : public AActor
{
    GENERATED_BODY()

public:
    ATakeOneSceneBuilder();

    UFUNCTION(BlueprintCallable, Category = "Take One|Scene")
    void BuildScene(const FTakeOneSceneSpec& Scene);

    UFUNCTION(BlueprintCallable, Category = "Take One|Scene")
    void ClearGeneratedScene();

    UFUNCTION(BlueprintCallable, Category = "Take One|Camera")
    void ActivateDirectorCamera(float BlendSeconds = 0.35f);

    UFUNCTION(BlueprintCallable, Category = "Take One|Camera")
    void ReturnToFreeCamera(float BlendSeconds = 0.25f);

    UFUNCTION(BlueprintCallable, Category = "Take One|Camera")
    void MoveFreeCameraToGeneratedShot();

    // Shoots a deterministic coverage set (orbit + height variants) of the
    // current generated set, encodes each frame as PNG, and uploads it to the
    // adapter so the web catalog can show real rendered stills.
    UFUNCTION(BlueprintCallable, Category = "Take One|Scene")
    void ShootFilmStills(const FString& FilmId, int32 ShotCount = 6);

    // Places performer proxies in the performance area so shots show people.
    UFUNCTION(BlueprintCallable, Category = "Take One|Scene")
    void SpawnPerformers(int32 Count);

    UFUNCTION(BlueprintPure, Category = "Take One|Scene")
    bool IsShooting() const { return ShotIndex < ShotTotal; }

    UPROPERTY(BlueprintAssignable, Category = "Take One|Scene")
    FTakeOneSceneBuilt OnSceneBuilt;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Take One|Scene")
    FTakeOneSceneSpec CurrentScene;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Take One|Scene")
    TObjectPtr<ACineCameraActor> DirectorCamera;

private:
    AActor* Track(AActor* Actor);

    void EnsureCaptureRig();
    void CaptureCurrentShot();
    void EncodeAndUploadShot();
    void FinishShoot();

    UPROPERTY(Transient)
    TObjectPtr<class USceneCaptureComponent2D> CaptureComponent;

    UPROPERTY(Transient)
    TObjectPtr<class UTextureRenderTarget2D> RenderTarget;

    FString ActiveFilmId;
    int32 ShotIndex = 0;
    int32 ShotTotal = 0;
    FTransform OriginalCameraTransform = FTransform::Identity;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(Transient)
    TArray<TObjectPtr<AActor>> GeneratedActors;

    UPROPERTY(Transient)
    TArray<TObjectPtr<ATakeOnePerformer>> Performers;
};
