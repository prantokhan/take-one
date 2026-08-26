#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "TakeOneSceneTypes.h"
#include "TakeOneDirectorWidget.generated.h"

class ATakeOneSceneBuilder;
class UButton;
class UMultiLineEditableTextBox;
class UTextBlock;

UCLASS()
class TAKEONE_API UTakeOneDirectorWidget : public UUserWidget
{
    GENERATED_BODY()

protected:
    virtual void NativeOnInitialized() override;
    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;

private:
    void BuildInterface();
    ATakeOneSceneBuilder* FindSceneBuilder() const;
    void SetBusy(bool bBusy);
    void SetStatus(const FString& Message, bool bIsError = false);

    UFUNCTION()
    void HandleGenerateClicked();

    UFUNCTION()
    void HandlePreviewCameraClicked();

    UFUNCTION()
    void HandleFreeCameraClicked();

    UFUNCTION()
    void HandleGenerationStarted(const FString& Prompt);

    UFUNCTION()
    void HandleGenerationCompleted(const FTakeOneSceneSpec& Scene, bool bUsedMockGenerator);

    UFUNCTION()
    void HandleGenerationFailed(const FString& Error);

    UPROPERTY(Transient)
    TObjectPtr<UMultiLineEditableTextBox> PromptBox;

    UPROPERTY(Transient)
    TObjectPtr<UButton> GenerateButton;

    UPROPERTY(Transient)
    TObjectPtr<UButton> PreviewCameraButton;

    UPROPERTY(Transient)
    TObjectPtr<UButton> FreeCameraButton;

    UPROPERTY(Transient)
    TObjectPtr<UTextBlock> StatusText;
};
