#include "TakeOnePlayerController.h"

#include "Blueprint/UserWidget.h"
#include "EngineUtils.h"
#include "GameFramework/DefaultPawn.h"
#include "TakeOneDirectorWidget.h"
#include "TakeOneSceneBuilder.h"
#include "TakeOneSceneGeneratorSubsystem.h"

void ATakeOnePlayerController::BeginPlay()
{
    Super::BeginPlay();

    EnsureFreeCameraPawn();
    EnsureSceneBuilder();

    bShowMouseCursor = true;
    FInputModeGameAndUI InputMode;
    InputMode.SetHideCursorDuringCapture(false);
    SetInputMode(InputMode);

    DirectorWidget = CreateWidget<UTakeOneDirectorWidget>(this, UTakeOneDirectorWidget::StaticClass());
    if (DirectorWidget)
    {
        DirectorWidget->AddToViewport(10);
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

void ATakeOnePlayerController::EnsureFreeCameraPawn()
{
    if (GetPawn() || !GetWorld())
    {
        return;
    }

    FActorSpawnParameters Parameters;
    Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    if (ADefaultPawn* FreeCamera = GetWorld()->SpawnActor<ADefaultPawn>(
        ADefaultPawn::StaticClass(),
        FVector(-1400.0f, -900.0f, 550.0f),
        FRotator(-12.0f, 32.0f, 0.0f),
        Parameters
    ))
    {
        Possess(FreeCamera);
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
