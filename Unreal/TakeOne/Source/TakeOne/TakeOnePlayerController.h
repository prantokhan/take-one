#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "TakeOneSceneTypes.h"
#include "TakeOnePlayerController.generated.h"

class ATakeOneSceneBuilder;
class UTakeOneDirectorWidget;

UCLASS()
class TAKEONE_API ATakeOnePlayerController : public APlayerController
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;

private:
    void EnsureWalkPawn();
    ATakeOneSceneBuilder* EnsureSceneBuilder();
    void ToggleDirectorInterface();
    void ShootActiveSetStills();

    // Movement + look, forwarded to the possessed ATakeOneWalkPawn.
    void MoveForward(float Value);
    void MoveRight(float Value);
    void Jump();
    void StopJumping();
    void TogglePerspective();

    UFUNCTION()
    void HandleSceneGenerated(const FTakeOneSceneSpec& Scene, bool bUsedMockGenerator);

    UPROPERTY(Transient)
    TObjectPtr<UTakeOneDirectorWidget> DirectorWidget;

    UPROPERTY(Transient)
    TObjectPtr<ATakeOneSceneBuilder> SceneBuilder;
};
