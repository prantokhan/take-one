#include "TakeOneGameMode.h"

#include "TakeOnePlayerController.h"
#include "TakeOneWalkPawn.h"

ATakeOneGameMode::ATakeOneGameMode()
{
    // Walkable capsule-collision character instead of the free-flying
    // ADefaultPawn spectator camera, so the player can move through a
    // generated set on foot rather than only fly around outside it.
    DefaultPawnClass = ATakeOneWalkPawn::StaticClass();
    PlayerControllerClass = ATakeOnePlayerController::StaticClass();
}
