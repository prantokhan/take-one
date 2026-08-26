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
    void EnsureFreeCameraPawn();
    ATakeOneSceneBuilder* EnsureSceneBuilder();
    void ToggleDirectorInterface();
    void ShootActiveSetStills();

    UFUNCTION()
    void HandleSceneGenerated(const FTakeOneSceneSpec& Scene, bool bUsedMockGenerator);

    UPROPERTY(Transient)
    TObjectPtr<UTakeOneDirectorWidget> DirectorWidget;

    UPROPERTY(Transient)
    TObjectPtr<ATakeOneSceneBuilder> SceneBuilder;
};
