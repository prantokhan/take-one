#include "TakeOneGameMode.h"

#include "GameFramework/DefaultPawn.h"
#include "TakeOnePlayerController.h"

ATakeOneGameMode::ATakeOneGameMode()
{
    DefaultPawnClass = ADefaultPawn::StaticClass();
    PlayerControllerClass = ATakeOnePlayerController::StaticClass();
}
