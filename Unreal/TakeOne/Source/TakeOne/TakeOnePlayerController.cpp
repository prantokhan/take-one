#include "TakeOnePlayerController.h"

#include "Blueprint/UserWidget.h"
#include "EngineUtils.h"
#include "TakeOneDirectorWidget.h"
#include "TakeOneSceneBuilder.h"
#include "TakeOneSceneGeneratorSubsystem.h"
#include "TakeOneWalkPawn.h"

void ATakeOnePlayerController::BeginPlay()
{
    Super::BeginPlay();

    EnsureWalkPawn();
    EnsureSceneBuilder();

    // Game-only input by default: mouse is captured for look, WASD drives
    // movement. ToggleDirectorInterface (Tab) flips to GameAndUI with the
    // cursor freed so the director panel can be clicked.
    bShowMouseCursor = false;
    SetInputMode(FInputModeGameOnly());

    DirectorWidget = CreateWidget<UTakeOneDirectorWidget>(this, UTakeOneDirectorWidget::StaticClass());
    if (DirectorWidget)
    {
        DirectorWidget->AddToViewport(10);
        // Start collapsed to match the game-only input mode above — the
        // player walks the set immediately; Tab opens the director panel.
        DirectorWidget->SetVisibility(ESlateVisibility::Collapsed);
    }

    if (UTakeOneSceneGeneratorSubsystem* Generator =
        GetGameInstance()->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
    {
        Generator->OnGenerationCompleted.AddUniqueDynamic(
            this,
            &ATakeOnePlayerController::HandleSceneGenerated
        );
        Generator->StartRemoteJobPolling();
        Generator->GenerateScene(
            TEXT("A neutral virtual production soundstage with a cyclorama and practical film lights.")
        );
    }
}

void ATakeOnePlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    if (InputComponent)
    {
        InputComponent->BindAction(
            TEXT("ToggleDirectorInterface"),
            IE_Pressed,
            this,
            &ATakeOnePlayerController::ToggleDirectorInterface
        );
        InputComponent->BindAction(
            TEXT("ShootStills"),
            IE_Pressed,
            this,
            &ATakeOnePlayerController::ShootActiveSetStills
        );
        InputComponent->BindAction(
            TEXT("TogglePerspective"),
            IE_Pressed,
            this,
            &ATakeOnePlayerController::TogglePerspective
        );
        InputComponent->BindAction(TEXT("Jump"), IE_Pressed, this, &ATakeOnePlayerController::Jump);
        InputComponent->BindAction(TEXT("Jump"), IE_Released, this, &ATakeOnePlayerController::StopJumping);

        InputComponent->BindAxis(TEXT("MoveForward"), this, &ATakeOnePlayerController::MoveForward);
        InputComponent->BindAxis(TEXT("MoveRight"), this, &ATakeOnePlayerController::MoveRight);
        InputComponent->BindAxis(TEXT("Turn"), this, &ATakeOnePlayerController::AddYawInput);
        InputComponent->BindAxis(TEXT("LookUp"), this, &ATakeOnePlayerController::AddPitchInput);
    }
}

void ATakeOnePlayerController::MoveForward(const float Value)
{
    if (ATakeOneWalkPawn* WalkPawn = Cast<ATakeOneWalkPawn>(GetPawn()))
    {
        WalkPawn->AddMovementInput(WalkPawn->GetActorForwardVector(), Value);
    }
}

void ATakeOnePlayerController::MoveRight(const float Value)
{
    if (ATakeOneWalkPawn* WalkPawn = Cast<ATakeOneWalkPawn>(GetPawn()))
    {
        WalkPawn->AddMovementInput(WalkPawn->GetActorRightVector(), Value);
    }
}

void ATakeOnePlayerController::Jump()
{
    if (ACharacter* Character = Cast<ACharacter>(GetPawn()))
    {
        Character->Jump();
    }
}

void ATakeOnePlayerController::StopJumping()
{
    if (ACharacter* Character = Cast<ACharacter>(GetPawn()))
    {
        Character->StopJumping();
    }
}

void ATakeOnePlayerController::TogglePerspective()
{
    if (ATakeOneWalkPawn* WalkPawn = Cast<ATakeOneWalkPawn>(GetPawn()))
    {
        WalkPawn->SetFirstPerson(!WalkPawn->IsFirstPerson());
    }
}

void ATakeOnePlayerController::ShootActiveSetStills()
{
    ATakeOneSceneBuilder* Builder = EnsureSceneBuilder();
    if (!Builder)
    {
        return;
    }

    FString FilmId;
    if (const UGameInstance* GameInstance = GetGameInstance())
    {
        if (const UTakeOneSceneGeneratorSubsystem* Generator =
            GameInstance->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
        {
            FilmId = Generator->GetActiveFilmId();
        }
    }
    Builder->ShootFilmStills(FilmId, 6);
}

void ATakeOnePlayerController::EnsureWalkPawn()
{
    if (GetPawn() || !GetWorld())
    {
        return;
    }

    // Spawn standing on the soundstage floor rather than at the old
    // free-camera's floating establishing-shot position — a walkable
    // character needs a ground start, not a hovering one. HandleSceneGenerated
    // repositions to the generated shot's establishing angle once the set is
    // ready, so this is only the pre-generation fallback spot.
    FActorSpawnParameters Parameters;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    if (ATakeOneWalkPawn* WalkPawn = GetWorld()->SpawnActor<ATakeOneWalkPawn>(
        ATakeOneWalkPawn::StaticClass(),
        FVector(0.0f, 0.0f, 100.0f),
        FRotator(0.0f, 32.0f, 0.0f),
        Parameters
    ))
    {
        Possess(WalkPawn);
    }
}

ATakeOneSceneBuilder* ATakeOnePlayerController::EnsureSceneBuilder()
{
    if (SceneBuilder)
    {
        return SceneBuilder;
    }

    for (TActorIterator<ATakeOneSceneBuilder> It(GetWorld()); It; ++It)
    {
        SceneBuilder = *It;
        return SceneBuilder;
    }

    FActorSpawnParameters Parameters;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    SceneBuilder = GetWorld()->SpawnActor<ATakeOneSceneBuilder>(
        ATakeOneSceneBuilder::StaticClass(),
        FTransform::Identity,
        Parameters
    );
    return SceneBuilder;
}

void ATakeOnePlayerController::ToggleDirectorInterface()
{
    if (!DirectorWidget)
    {
        return;
    }

    const bool bWillShow = DirectorWidget->GetVisibility() == ESlateVisibility::Collapsed;
    DirectorWidget->SetVisibility(bWillShow ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    bShowMouseCursor = bWillShow;

    if (bWillShow)
    {
        FInputModeGameAndUI InputMode;
        InputMode.SetHideCursorDuringCapture(false);
        SetInputMode(InputMode);
    }
    else
    {
        SetInputMode(FInputModeGameOnly());
    }
}

void ATakeOnePlayerController::HandleSceneGenerated(
    const FTakeOneSceneSpec& Scene,
    const bool /*bUsedMockGenerator*/
)
{
    if (ATakeOneSceneBuilder* Builder = EnsureSceneBuilder())
    {
        Builder->BuildScene(Scene);
        int32 CastCount = 2;
        if (const UGameInstance* GameInstance = GetGameInstance())
        {
            if (const UTakeOneSceneGeneratorSubsystem* Generator =
                GameInstance->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
            {
                CastCount = Generator->GetActiveCastCount();
            }
        }
        Builder->SpawnPerformers(CastCount);
        Builder->MoveFreeCameraToGeneratedShot();
    }
}
