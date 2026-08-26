#include "TakeOneDirectorWidget.h"

#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/ButtonSlot.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/MultiLineEditableTextBox.h"
#include "Components/SizeBox.h"
#include "Components/Spacer.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "EngineUtils.h"
#include "TakeOne.h"
#include "TakeOneSceneBuilder.h"
#include "TakeOneSceneGeneratorSubsystem.h"

namespace
{
UTextBlock* MakeText(UWidgetTree* WidgetTree, const FString& Text, const int32 Size, const FLinearColor& Color)
{
    UTextBlock* TextBlock = WidgetTree->ConstructWidget<UTextBlock>();
    TextBlock->SetText(FText::FromString(Text));
    TextBlock->SetColorAndOpacity(FSlateColor(Color));

    FSlateFontInfo Font = TextBlock->GetFont();
    Font.Size = Size;
    TextBlock->SetFont(Font);
    return TextBlock;
}

void AddSpacer(UWidgetTree* WidgetTree, UVerticalBox* Box, const float Height)
{
    USpacer* Spacer = WidgetTree->ConstructWidget<USpacer>();
    Spacer->SetSize(FVector2D(1.0f, Height));
    Box->AddChildToVerticalBox(Spacer);
}

void AddButtonText(UWidgetTree* WidgetTree, UButton* Button, const FString& Text)
{
    UTextBlock* Label = MakeText(WidgetTree, Text, 13, FLinearColor(0.92f, 0.94f, 0.91f));
    Label->SetJustification(ETextJustify::Center);
    if (UButtonSlot* Slot = Cast<UButtonSlot>(Button->AddChild(Label)))
    {
        Slot->SetPadding(FMargin(12.0f, 9.0f));
        Slot->SetHorizontalAlignment(HAlign_Center);
        Slot->SetVerticalAlignment(VAlign_Center);
    }
}
}

void UTakeOneDirectorWidget::NativeOnInitialized()
{
    Super::NativeOnInitialized();

    if (!WidgetTree->RootWidget)
    {
        BuildInterface();
    }

    UE_LOG(LogTakeOne, Log, TEXT("Director interface initialized."));
}

void UTakeOneDirectorWidget::NativeConstruct()
{
    Super::NativeConstruct();

    if (GetGameInstance())
    {
        if (UTakeOneSceneGeneratorSubsystem* Generator =
            GetGameInstance()->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
        {
            Generator->OnGenerationStarted.AddUniqueDynamic(
                this,
                &UTakeOneDirectorWidget::HandleGenerationStarted
            );
            Generator->OnGenerationCompleted.AddUniqueDynamic(
                this,
                &UTakeOneDirectorWidget::HandleGenerationCompleted
            );
            Generator->OnGenerationFailed.AddUniqueDynamic(
                this,
                &UTakeOneDirectorWidget::HandleGenerationFailed
            );
        }
    }
}

void UTakeOneDirectorWidget::NativeDestruct()
{
    if (GetGameInstance())
    {
        if (UTakeOneSceneGeneratorSubsystem* Generator =
            GetGameInstance()->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
        {
            Generator->OnGenerationStarted.RemoveAll(this);
            Generator->OnGenerationCompleted.RemoveAll(this);
            Generator->OnGenerationFailed.RemoveAll(this);
        }
    }

    Super::NativeDestruct();
}

void UTakeOneDirectorWidget::BuildInterface()
{
    const FLinearColor Ink(0.055f, 0.065f, 0.06f, 0.96f);
    const FLinearColor Paper(0.87f, 0.89f, 0.84f);
    const FLinearColor Muted(0.58f, 0.62f, 0.57f);

    UCanvasPanel* Root = WidgetTree->ConstructWidget<UCanvasPanel>();
    WidgetTree->RootWidget = Root;

    UBorder* Panel = WidgetTree->ConstructWidget<UBorder>();
    Panel->SetBrushColor(Ink);
    Panel->SetPadding(FMargin(22.0f));
    UCanvasPanelSlot* PanelSlot = Root->AddChildToCanvas(Panel);
    PanelSlot->SetAnchors(FAnchors(0.0f, 0.0f));
    PanelSlot->SetPosition(FVector2D(24.0f, 24.0f));
    PanelSlot->SetSize(FVector2D(460.0f, 390.0f));

    UVerticalBox* Stack = WidgetTree->ConstructWidget<UVerticalBox>();
    Panel->SetContent(Stack);

    UTextBlock* Eyebrow = MakeText(WidgetTree, TEXT("TAKE ONE / AI SET BUILDER"), 11, Muted);
    Stack->AddChildToVerticalBox(Eyebrow);

    UTextBlock* Title = MakeText(WidgetTree, TEXT("You direct. AI builds the set."), 23, Paper);
    Title->SetAutoWrapText(true);
    Stack->AddChildToVerticalBox(Title);

    AddSpacer(WidgetTree, Stack, 8.0f);

    UTextBlock* Help = MakeText(
        WidgetTree,
        TEXT("Describe the physical scene, atmosphere, era, and practical details. Every generated element remains editable."),
        12,
        Muted
    );
    Help->SetAutoWrapText(true);
    Stack->AddChildToVerticalBox(Help);

    AddSpacer(WidgetTree, Stack, 14.0f);

    USizeBox* PromptSize = WidgetTree->ConstructWidget<USizeBox>();
    PromptSize->SetHeightOverride(118.0f);
    Stack->AddChildToVerticalBox(PromptSize);

    PromptBox = WidgetTree->ConstructWidget<UMultiLineEditableTextBox>();
    PromptBox->SetText(FText::FromString(
        TEXT("An abandoned 1980s railway station at night, wet concrete, warm practical lights, and heavy fog.")
    ));
    PromptBox->SetHintText(FText::FromString(TEXT("Describe a set for the AI to generate...")));
    PromptBox->SetAutoWrapText(true);
    PromptSize->SetContent(PromptBox);

    AddSpacer(WidgetTree, Stack, 12.0f);

    GenerateButton = WidgetTree->ConstructWidget<UButton>();
    GenerateButton->SetBackgroundColor(FLinearColor(0.65f, 0.34f, 0.12f, 1.0f));
    AddButtonText(WidgetTree, GenerateButton, TEXT("GENERATE EDITABLE SCENE"));
    GenerateButton->OnClicked.AddUniqueDynamic(this, &UTakeOneDirectorWidget::HandleGenerateClicked);
    Stack->AddChildToVerticalBox(GenerateButton);

    AddSpacer(WidgetTree, Stack, 9.0f);

    UHorizontalBox* CameraRow = WidgetTree->ConstructWidget<UHorizontalBox>();
    Stack->AddChildToVerticalBox(CameraRow);

    PreviewCameraButton = WidgetTree->ConstructWidget<UButton>();
    AddButtonText(WidgetTree, PreviewCameraButton, TEXT("PREVIEW SHOT"));
    PreviewCameraButton->OnClicked.AddUniqueDynamic(
        this,
        &UTakeOneDirectorWidget::HandlePreviewCameraClicked
    );
    UHorizontalBoxSlot* PreviewSlot = CameraRow->AddChildToHorizontalBox(PreviewCameraButton);
    PreviewSlot->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
    PreviewSlot->SetPadding(FMargin(0.0f, 0.0f, 5.0f, 0.0f));

    FreeCameraButton = WidgetTree->ConstructWidget<UButton>();
    AddButtonText(WidgetTree, FreeCameraButton, TEXT("FREE CAMERA"));
    FreeCameraButton->OnClicked.AddUniqueDynamic(this, &UTakeOneDirectorWidget::HandleFreeCameraClicked);
    UHorizontalBoxSlot* FreeSlot = CameraRow->AddChildToHorizontalBox(FreeCameraButton);
    FreeSlot->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
    FreeSlot->SetPadding(FMargin(5.0f, 0.0f, 0.0f, 0.0f));

    AddSpacer(WidgetTree, Stack, 10.0f);

    StatusText = MakeText(WidgetTree, TEXT("Ready. Press Tab to show or hide this panel."), 11, Muted);
    StatusText->SetAutoWrapText(true);
    Stack->AddChildToVerticalBox(StatusText);
}

ATakeOneSceneBuilder* UTakeOneDirectorWidget::FindSceneBuilder() const
{
    if (!GetWorld())
    {
        return nullptr;
    }

    for (TActorIterator<ATakeOneSceneBuilder> It(GetWorld()); It; ++It)
    {
        return *It;
    }
    return nullptr;
}

void UTakeOneDirectorWidget::SetBusy(const bool bBusy)
{
    if (GenerateButton)
    {
        GenerateButton->SetIsEnabled(!bBusy);
    }
    if (PromptBox)
    {
        PromptBox->SetIsReadOnly(bBusy);
    }
}

void UTakeOneDirectorWidget::SetStatus(const FString& Message, const bool bIsError)
{
    if (!StatusText)
    {
        return;
    }

    StatusText->SetText(FText::FromString(Message));
    StatusText->SetColorAndOpacity(
        FSlateColor(bIsError
            ? FLinearColor(1.0f, 0.36f, 0.28f)
            : FLinearColor(0.58f, 0.68f, 0.58f))
    );
}

void UTakeOneDirectorWidget::HandleGenerateClicked()
{
    if (!PromptBox || !GetGameInstance())
    {
        return;
    }

    if (UTakeOneSceneGeneratorSubsystem* Generator =
        GetGameInstance()->GetSubsystem<UTakeOneSceneGeneratorSubsystem>())
    {
        Generator->GenerateScene(PromptBox->GetText().ToString());
    }
}

void UTakeOneDirectorWidget::HandlePreviewCameraClicked()
{
    if (ATakeOneSceneBuilder* Builder = FindSceneBuilder())
    {
        Builder->ActivateDirectorCamera();
        SetStatus(TEXT("Previewing the AI-generated shot. Choose Free Camera to keep directing."));
    }
}

void UTakeOneDirectorWidget::HandleFreeCameraClicked()
{
    if (ATakeOneSceneBuilder* Builder = FindSceneBuilder())
    {
        Builder->ReturnToFreeCamera();
        SetStatus(TEXT("Free camera active. Use WASD, mouse, Space, and Ctrl to inspect the set."));
    }
}

void UTakeOneDirectorWidget::HandleGenerationStarted(const FString& Prompt)
{
    SetBusy(true);
    SetStatus(FString::Printf(TEXT("Generating: %s"), *Prompt.Left(90)));
}

void UTakeOneDirectorWidget::HandleGenerationCompleted(
    const FTakeOneSceneSpec& Scene,
    const bool bUsedMockGenerator
)
{
    SetBusy(false);
    SetStatus(FString::Printf(
        TEXT("%s built with %d editable elements%s."),
        *Scene.Title,
        Scene.Objects.Num(),
        bUsedMockGenerator ? TEXT(" (mock generator)") : TEXT("")
    ));
}

void UTakeOneDirectorWidget::HandleGenerationFailed(const FString& Error)
{
    SetBusy(false);
    SetStatus(Error, true);
}
