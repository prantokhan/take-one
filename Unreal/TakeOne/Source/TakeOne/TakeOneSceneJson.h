#pragma once

#include "CoreMinimal.h"
#include "TakeOneSceneTypes.h"

class FTakeOneSceneJson
{
public:
    static FString SerializeGenerationRequest(const FString& Prompt);
    static bool DeserializeScene(const FString& Json, FTakeOneSceneSpec& OutScene, FString& OutError);

private:
    static FVector ReadVector(const TSharedPtr<FJsonObject>& Object, const FVector& DefaultValue);
    static FRotator ReadRotator(const TSharedPtr<FJsonObject>& Object, const FRotator& DefaultValue);
    static FLinearColor ReadColor(const FString& Hex, const FLinearColor& DefaultValue);
};
