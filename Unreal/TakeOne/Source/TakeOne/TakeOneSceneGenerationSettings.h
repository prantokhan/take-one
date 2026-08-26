#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "TakeOneSceneGenerationSettings.generated.h"

UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Take One Scene Generation"))
class TAKEONE_API UTakeOneSceneGenerationSettings : public UDeveloperSettings
{
    GENERATED_BODY()

public:
    UTakeOneSceneGenerationSettings();

    virtual FName GetCategoryName() const override;

    // Mock mode is deterministic and needs no server. Disable it when a scene
    // generation service implementing ServiceContract/scene-generation.schema.json
    // is running.
    UPROPERTY(Config, EditAnywhere, Category = "Connection")
    bool bUseMockGenerator = true;

    UPROPERTY(Config, EditAnywhere, Category = "Connection", meta = (EditCondition = "!bUseMockGenerator"))
    FString ServiceUrl = TEXT("http://127.0.0.1:8787/v1/scenes/generate");

    UPROPERTY(Config, EditAnywhere, Category = "Connection", meta = (ClampMin = "1.0", ClampMax = "300.0"))
    float RequestTimeoutSeconds = 60.0f;

    // The client reads a service token from this environment variable. Do not
    // put model-provider API keys in a packaged Unreal client.
    UPROPERTY(Config, EditAnywhere, Category = "Connection")
    FString ServiceTokenEnvironmentVariable = TEXT("TAKEONE_SCENE_SERVICE_TOKEN");

    UPROPERTY(Config, EditAnywhere, Category = "Resilience", meta = (EditCondition = "!bUseMockGenerator"))
    bool bFallbackToMockOnError = true;

    // When true, the client polls the adapter's job queue so sets prompted from
    // the web game (or any other consumer) build themselves in-engine.
    UPROPERTY(Config, EditAnywhere, Category = "Connection")
    bool bConsumeRemoteJobs = true;
};
