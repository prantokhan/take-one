#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "TakeOneSceneTypes.h"
#include "TakeOneSceneGeneratorSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTakeOneGenerationStarted, const FString&, Prompt);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FTakeOneGenerationCompleted,
    const FTakeOneSceneSpec&,
    Scene,
    bool,
    bUsedMockGenerator
);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTakeOneGenerationFailed, const FString&, Error);

UCLASS()
class TAKEONE_API UTakeOneSceneGeneratorSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "Take One|Scene Generation")
    void GenerateScene(const FString& Prompt);

    // Begins polling the adapter job queue so scenes prompted from other
    // clients (e.g. the web game) build automatically in this world.
    void StartRemoteJobPolling();

    // Film id carried by the last claimed remote job ("" if none).
    UFUNCTION(BlueprintPure, Category = "Take One|Scene Generation")
    const FString& GetActiveFilmId() const { return ActiveFilmId; }

    // Cast size carried by the last claimed remote job (how many performers
    // to stage in the set).
    UFUNCTION(BlueprintPure, Category = "Take One|Scene Generation")
    int32 GetActiveCastCount() const { return ActiveCastCount; }

    UFUNCTION(BlueprintPure, Category = "Take One|Scene Generation")
    bool IsGenerating() const { return bIsGenerating; }

    UPROPERTY(BlueprintAssignable, Category = "Take One|Scene Generation")
    FTakeOneGenerationStarted OnGenerationStarted;

    UPROPERTY(BlueprintAssignable, Category = "Take One|Scene Generation")
    FTakeOneGenerationCompleted OnGenerationCompleted;

    UPROPERTY(BlueprintAssignable, Category = "Take One|Scene Generation")
    FTakeOneGenerationFailed OnGenerationFailed;

private:
    void GenerateMockScene(const FString& Prompt, bool bIsFallback);
    void HandleHttpComplete(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
    void FailGeneration(const FString& Error);
    void PollRemoteJobs();
    void HandlePollComplete(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);

    bool bIsGenerating = false;
    FString PendingPrompt;
    FString ActiveFilmId;
    int32 ActiveCastCount = 0;
    FHttpRequestPtr ActiveRequest;
    bool bRemotePollingStarted = false;
    FString RemoteJobsUrl;
    FTimerHandle RemotePollTimerHandle;
};
