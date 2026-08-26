#include "TakeOneWalkPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"

ATakeOneWalkPawn::ATakeOneWalkPawn()
{
    PrimaryActorTick.bCanEverTick = false;

    // Standard human-scale capsule so the pawn collides with the set geometry
    // TakeOneSceneBuilder spawns (floor, walls, dressing) instead of flying
    // through it like the old ADefaultPawn spectator camera did.
    GetCapsuleComponent()->InitCapsuleSize(34.0f, 88.0f);

    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate = FRotator(0.0f, 540.0f, 0.0f);
    GetCharacterMovement()->JumpZVelocity = 480.0f;
    GetCharacterMovement()->AirControl = 0.25f;
    GetCharacterMovement()->MaxWalkSpeed = 480.0f;

    CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    CameraBoom->SetupAttachment(RootComponent);
    CameraBoom->TargetArmLength = ThirdPersonArmLength;
    CameraBoom->SocketOffset = FVector(0.0f, 0.0f, 60.0f);
    CameraBoom->bUsePawnControlRotation = true;
    CameraBoom->bEnableCameraLag = true;
    CameraBoom->CameraLagSpeed = 12.0f;
    CameraBoom->bDoCollisionTest = true;

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false;
    FollowCamera->SetFieldOfView(90.0f);
}

void ATakeOneWalkPawn::BeginPlay()
{
    Super::BeginPlay();

    // Start in first-person so the player is immediately looking through the
    // director's eyes on the set rather than at their own back.
    SetFirstPerson(true);
}

void ATakeOneWalkPawn::MoveForward(const float Value)
{
    if (Controller && Value != 0.0f)
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Value);
    }
}

void ATakeOneWalkPawn::MoveRight(const float Value)
{
    if (Controller && Value != 0.0f)
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Value);
    }
}

void ATakeOneWalkPawn::TogglePerspective()
{
    SetFirstPerson(!bIsFirstPerson);
}

void ATakeOneWalkPawn::SetFirstPerson(const bool bFirstPerson)
{
    bIsFirstPerson = bFirstPerson;

    // Retract the boom to the eye socket rather than switching cameras, so
    // FOV/lag/collision settings stay defined in exactly one place.
    CameraBoom->TargetArmLength = bFirstPerson ? 0.0f : ThirdPersonArmLength;
    CameraBoom->SocketOffset = bFirstPerson
        ? FVector(0.0f, 0.0f, FirstPersonEyeHeight - GetDefaultHalfHeight())
        : FVector(0.0f, 0.0f, 60.0f);
    CameraBoom->bDoCollisionTest = !bFirstPerson;
    bUseControllerRotationYaw = bFirstPerson;
    GetCharacterMovement()->bOrientRotationToMovement = !bFirstPerson;

    // Hide the body from the owning player only in first-person so it can't
    // clip into the lens; it stays visible in third-person and to any other
    // observer (e.g. a spectating camera) in both modes.
    GetMesh()->SetOwnerNoSee(bFirstPerson);
}
