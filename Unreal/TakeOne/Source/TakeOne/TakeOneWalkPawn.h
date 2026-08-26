#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "TakeOneWalkPawn.generated.h"

class USpringArmComponent;
class UCameraComponent;

// A walkable director avatar: capsule-collision Character with WASD + mouse-look
// movement over the procedurally generated set, and a first-/third-person camera
// toggle (default action "TogglePerspective", see DefaultInput.ini). Used in
// place of the free-flying ADefaultPawn spectator camera so the player can
// actually move through a generated set on foot rather than only fly around it.
UCLASS()
class TAKEONE_API ATakeOneWalkPawn : public ACharacter
{
    GENERATED_BODY()

public:
    ATakeOneWalkPawn();

    // Switches between third-person (boomed-out, character mesh visible to
    // other viewers) and first-person (camera at eye height, mesh hidden from
    // the owning player only so it doesn't clip the view).
    UFUNCTION(BlueprintCallable, Category = "Take One|Camera")
    void SetFirstPerson(bool bFirstPerson);

    UFUNCTION(BlueprintCallable, Category = "Take One|Camera")
    bool IsFirstPerson() const { return bIsFirstPerson; }

protected:
    virtual void BeginPlay() override;

    void MoveForward(float Value);
    void MoveRight(float Value);
    void TogglePerspective();

    // Third-person boom; retracted to ~0 for first-person rather than swapped
    // for a second camera component, so both modes share one set of lens
    // settings (FOV, post-process) defined once in the constructor.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Take One|Camera")
    TObjectPtr<USpringArmComponent> CameraBoom;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Take One|Camera")
    TObjectPtr<UCameraComponent> FollowCamera;

    UPROPERTY(EditAnywhere, Category = "Take One|Camera")
    float ThirdPersonArmLength = 320.0f;

    UPROPERTY(EditAnywhere, Category = "Take One|Camera")
    float FirstPersonEyeHeight = 74.0f;

    bool bIsFirstPerson = false;
};
