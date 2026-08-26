#include "TakeOneSceneBuilder.h"

#include "Camera/CameraComponent.h"
#include "CineCameraActor.h"
#include "CineCameraComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Components/SceneComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/SkyLight.h"
#include "Engine/TextureRenderTarget2D.h"
#include "GameFramework/Pawn.h"
#include "HttpModule.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/Base64.h"
#include "Modules/ModuleManager.h"
#include "RenderingThread.h"
#include "TakeOne.h"
#include "TakeOneGeneratedObject.h"
#include "TakeOnePerformer.h"

namespace
{
FString SlugForFilmId(const FString& FilmId)
{
    FString Slug;
    bool bLastWasSeparator = true;
    for (const TCHAR Character : FilmId)
    {
        if (FChar::IsAlnum(Character))
        {
            Slug.AppendChar(FChar::ToLower(Character));
            bLastWasSeparator = false;
        }
        else if (!bLastWasSeparator)
        {
            Slug.AppendChar(TEXT('-'));
            bLastWasSeparator = true;
        }
    }
    return Slug.IsEmpty() ? TEXT("freeshoot") : Slug.Left(80);
}
}

ATakeOneSceneBuilder::ATakeOneSceneBuilder()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);
    Tags.Add(TEXT("TakeOne.SceneBuilder"));
}

void ATakeOneSceneBuilder::BuildScene(const FTakeOneSceneSpec& Scene)
{
    UWorld* World = GetWorld();
    if (!World)
    {
        return;
    }

    ClearGeneratedScene();
    CurrentScene = Scene;

    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    FTakeOneSceneObjectSpec Ground;
    Ground.Id = TEXT("generated_ground");
    Ground.Label = TEXT("Generated ground");
    Ground.Primitive = ETakeOnePrimitiveType::Cube;
    Ground.Location = FVector(0.0f, 0.0f, -50.0f);
    Ground.Scale = FVector(55.0f, 55.0f, 1.0f);
    Ground.Color = Scene.Environment.GroundColor;
    Ground.AssetHint = TEXT("environment ground surface");

    if (ATakeOneGeneratedObject* GroundActor = World->SpawnActor<ATakeOneGeneratedObject>(
        ATakeOneGeneratedObject::StaticClass(),
        FTransform::Identity,
        SpawnParameters
    ))
    {
        GroundActor->InitializeFromSpec(Ground);
        Track(GroundActor);
    }

    for (const FTakeOneSceneObjectSpec& ObjectSpec : Scene.Objects)
    {
        if (ATakeOneGeneratedObject* Object = World->SpawnActor<ATakeOneGeneratedObject>(
            ATakeOneGeneratedObject::StaticClass(),
            FTransform::Identity,
            SpawnParameters
        ))
        {
            Object->InitializeFromSpec(ObjectSpec);
            Track(Object);
        }
    }

    if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(
        ADirectionalLight::StaticClass(),
        FVector::ZeroVector,
        Scene.Environment.SunRotation,
        SpawnParameters
    ))
    {
        Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
        Sun->GetLightComponent()->SetIntensity(Scene.Environment.SunIntensity);
        Sun->GetLightComponent()->SetLightColor(Scene.Environment.SunColor);
        if (UDirectionalLightComponent* DirectionalComponent =
            Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
        {
            DirectionalComponent->SetAtmosphereSunLight(true);
        }
        Track(Sun);
    }

    if (ASkyAtmosphere* Atmosphere = World->SpawnActor<ASkyAtmosphere>(
        ASkyAtmosphere::StaticClass(),
        FTransform::Identity,
        SpawnParameters
    ))
    {
        Track(Atmosphere);
    }

    if (ASkyLight* SkyLight = World->SpawnActor<ASkyLight>(
        ASkyLight::StaticClass(),
        FTransform::Identity,
        SpawnParameters
    ))
    {
        SkyLight->GetLightComponent()->SetMobility(EComponentMobility::Movable);
        SkyLight->GetLightComponent()->SetIntensity(Scene.Environment.SkyLightIntensity);
        SkyLight->GetLightComponent()->SetLightColor(Scene.Environment.SkyLightColor);
        SkyLight->GetLightComponent()->SetRealTimeCapture(true);
        Track(SkyLight);
    }

    if (AExponentialHeightFog* Fog = World->SpawnActor<AExponentialHeightFog>(
        AExponentialHeightFog::StaticClass(),
        FTransform::Identity,
        SpawnParameters
    ))
    {
        Fog->GetComponent()->SetFogDensity(Scene.Environment.FogDensity);
        Fog->GetComponent()->SetFogHeightFalloff(0.2f);
        Track(Fog);
    }

    DirectorCamera = World->SpawnActor<ACineCameraActor>(
        ACineCameraActor::StaticClass(),
        Scene.Camera.Location,
        Scene.Camera.Rotation,
        SpawnParameters
    );
    if (DirectorCamera)
    {
        DirectorCamera->GetCineCameraComponent()->SetFieldOfView(Scene.Camera.FieldOfView);
        DirectorCamera->Tags.Add(TEXT("TakeOne.DirectorCamera"));
        Track(DirectorCamera);
#if WITH_EDITOR
        DirectorCamera->SetActorLabel(TEXT("AI Generated Director Camera"));
#endif
    }

    UE_LOG(
        LogTakeOne,
        Log,
        TEXT("Built scene '%s' with %d generated objects."),
        *Scene.Title,
        Scene.Objects.Num()
    );
    OnSceneBuilt.Broadcast(CurrentScene, Scene.Objects.Num() + 1);
}

void ATakeOneSceneBuilder::ClearGeneratedScene()
{
    for (AActor* Actor : GeneratedActors)
    {
        if (IsValid(Actor))
        {
            Actor->Destroy();
        }
    }

    GeneratedActors.Reset();
    Performers.Reset();
    DirectorCamera = nullptr;
    CurrentScene = FTakeOneSceneSpec();
}

void ATakeOneSceneBuilder::ActivateDirectorCamera(const float BlendSeconds)
{
    if (!DirectorCamera)
    {
        return;
    }

    if (APlayerController* PlayerController = UGameplayStatics::GetPlayerController(this, 0))
    {
        PlayerController->SetViewTargetWithBlend(DirectorCamera, FMath::Max(0.0f, BlendSeconds));
    }
}

void ATakeOneSceneBuilder::ReturnToFreeCamera(const float BlendSeconds)
{
    if (APlayerController* PlayerController = UGameplayStatics::GetPlayerController(this, 0))
    {
        if (APawn* Pawn = PlayerController->GetPawn())
        {
            PlayerController->SetViewTargetWithBlend(Pawn, FMath::Max(0.0f, BlendSeconds));
        }
    }
}

void ATakeOneSceneBuilder::MoveFreeCameraToGeneratedShot()
{
    if (!DirectorCamera)
    {
        return;
    }

    if (APlayerController* PlayerController = UGameplayStatics::GetPlayerController(this, 0))
    {
        if (APawn* Pawn = PlayerController->GetPawn())
        {
            Pawn->SetActorLocationAndRotation(
                DirectorCamera->GetActorLocation(),
                DirectorCamera->GetActorRotation()
            );
            PlayerController->SetControlRotation(DirectorCamera->GetActorRotation());
            PlayerController->SetViewTarget(Pawn);
        }
    }
}

AActor* ATakeOneSceneBuilder::Track(AActor* Actor)
{
    if (Actor)
    {
        Actor->Tags.AddUnique(TEXT("TakeOne.Generated"));
        GeneratedActors.Add(Actor);
    }
    return Actor;
}

void ATakeOneSceneBuilder::SpawnPerformers(const int32 Count)
{
    UWorld* World = GetWorld();
    if (!World || !DirectorCamera)
    {
        return;
    }

    for (ATakeOnePerformer* Performer : Performers)
    {
        if (IsValid(Performer))
        {
            Performer->Destroy();
        }
    }
    Performers.Reset();

    const int32 PerformerCount = FMath::Clamp(Count, 0, 3);
    if (!PerformerCount)
    {
        return;
    }

    // Stage them in the performance area the director camera is framing.
    const FVector FocusPoint = DirectorCamera->GetActorLocation() + DirectorCamera->GetActorForwardVector() * 1600.0f;
    const FVector GroundPoint(FocusPoint.X, FocusPoint.Y, 0.0f);
    const FRotator FacingCamera = (-DirectorCamera->GetActorForwardVector()).Rotation();

    static const TArray<FVector> Offsets = {
        FVector(-160.0f, -60.0f, 0.0f),
        FVector(170.0f, 40.0f, 0.0f),
        FVector(20.0f, 190.0f, 0.0f)
    };
    static const TArray<FLinearColor> Costumes = {
        FLinearColor(0.16f, 0.32f, 0.55f, 1.0f),
        FLinearColor(0.55f, 0.18f, 0.14f, 1.0f),
        FLinearColor(0.2f, 0.42f, 0.28f, 1.0f)
    };

    for (int32 Index = 0; Index < PerformerCount; ++Index)
    {
        FActorSpawnParameters SpawnParameters;
        SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        if (ATakeOnePerformer* Performer = World->SpawnActor<ATakeOnePerformer>(
            ATakeOnePerformer::StaticClass(),
            FTransform::Identity,
            SpawnParameters
        ))
        {
            Performer->InitializeFromSetup(
                GroundPoint + Offsets[Index % Offsets.Num()],
                FacingCamera,
                Costumes[Index % Costumes.Num()],
                static_cast<float>(Index) * 2.1f,
                FString::Printf(TEXT("First Team %c"), TEXT("ABC")[Index % 3])
            );
            Track(Performer);
            Performers.Add(Performer);
        }
    }

    UE_LOG(LogTakeOne, Log, TEXT("Staged %d performers in the performance area."), Performers.Num());
}

void ATakeOneSceneBuilder::ShootFilmStills(const FString& FilmId, const int32 ShotCount)
{
    UWorld* World = GetWorld();
    if (!World || !DirectorCamera)
    {
        UE_LOG(LogTakeOne, Warning, TEXT("ShootFilmStills skipped: no generated set or camera."));
        return;
    }
    if (IsShooting())
    {
        UE_LOG(LogTakeOne, Warning, TEXT("ShootFilmStills skipped: a shoot is already running."));
        return;
    }

    ActiveFilmId = SlugForFilmId(FilmId);
    ShotTotal = FMath::Clamp(ShotCount, 1, 12);
    ShotIndex = 0;
    OriginalCameraTransform = DirectorCamera->GetActorTransform();

    EnsureCaptureRig();
    UE_LOG(LogTakeOne, Log, TEXT("Shooting %d stills for film '%s'."), ShotTotal, *ActiveFilmId);

    // Let the capture rig settle for one frame before the first shot.
    GetWorld()->GetTimerManager().SetTimerForNextTick(
        FTimerDelegate::CreateUObject(this, &ATakeOneSceneBuilder::CaptureCurrentShot)
    );
}

void ATakeOneSceneBuilder::EnsureCaptureRig()
{
    if (!DirectorCamera)
    {
        return;
    }

    if (!CaptureComponent)
    {
        CaptureComponent = NewObject<USceneCaptureComponent2D>(this);
        CaptureComponent->SetupAttachment(DirectorCamera->GetRootComponent());
        CaptureComponent->RegisterComponent();
        CaptureComponent->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
        CaptureComponent->bAlwaysPersistRenderingState = true;
    }

    if (!RenderTarget)
    {
        RenderTarget = NewObject<UTextureRenderTarget2D>(this);
        RenderTarget->InitCustomFormat(1280, 720, PF_B8G8R8A8, true);
        RenderTarget->RenderTargetFormat = RTF_RGBA8_SRGB;
        RenderTarget->ClearColor = FLinearColor::Black;
        RenderTarget->UpdateResourceImmediate(true);
    }

    CaptureComponent->TextureTarget = RenderTarget;
    CaptureComponent->FOVAngle = DirectorCamera->GetCineCameraComponent()->FieldOfView;
}

void ATakeOneSceneBuilder::CaptureCurrentShot()
{
    UWorld* World = GetWorld();
    if (!World || !DirectorCamera || ShotIndex >= ShotTotal)
    {
        FinishShoot();
        return;
    }

    // Deterministic moving master: one continuous 360-degree orbit sweep with
    // a gentle height arc, so the frame sequence plays back as motion.
    const float SweepFraction = static_cast<float>(ShotIndex) / FMath::Max(ShotTotal, 1);
    const float OrbitStep = 360.0f * SweepFraction;
    const float HeightOffset = FMath::Sin(SweepFraction * 2.0f * PI) * 140.0f;
    const FRotator OriginalRotation = OriginalCameraTransform.GetRotation().Rotator();

    const FVector FocusPoint = OriginalCameraTransform.GetLocation() + OriginalRotation.Vector() * 1600.0f;
    const FVector OffsetFromFocus = OriginalCameraTransform.GetLocation() - FocusPoint;
    const FRotator OrbitRotation(0.0f, OrbitStep, 0.0f);
    const FVector NewLocation = FocusPoint + OrbitRotation.RotateVector(OffsetFromFocus) + FVector(0.0f, 0.0f, HeightOffset);

    DirectorCamera->SetActorLocationAndRotation(NewLocation, OriginalRotation);
    if (CaptureComponent)
    {
        if (UCameraComponent* CineCamera = DirectorCamera->GetCineCameraComponent())
        {
            CaptureComponent->FOVAngle = CineCamera->FieldOfView;
        }
    }

    // Give the transform a tick to propagate before capturing.
    GetWorld()->GetTimerManager().SetTimerForNextTick(
        FTimerDelegate::CreateWeakLambda(this, [this]()
        {
            if (!GetWorld())
            {
                return;
            }
            if (CaptureComponent && RenderTarget)
            {
                CaptureComponent->CaptureScene();
                FlushRenderingCommands();
            }
            EncodeAndUploadShot();
        })
    );
}

void ATakeOneSceneBuilder::EncodeAndUploadShot()
{
    const int32 Index = ShotIndex;

    TArray64<uint8> CompressedPng;
    bool bCapturedFrame = false;
    if (RenderTarget)
    {
        if (FTextureRenderTargetResource* Resource = RenderTarget->GameThread_GetRenderTargetResource())
        {
            TArray<FColor> Pixels;
            if (Resource->ReadPixels(Pixels))
            {
                IImageWrapperModule& ImageWrapperModule =
                    FModuleManager::LoadModuleChecked<IImageWrapperModule>(FName("ImageWrapper"));
                const TSharedPtr<IImageWrapper> PngWrapper = ImageWrapperModule.CreateImageWrapper(EImageFormat::PNG);
                if (PngWrapper.IsValid() &&
                    PngWrapper->SetRaw(
                        Pixels.GetData(),
                        Pixels.Num() * sizeof(FColor),
                        RenderTarget->SizeX,
                        RenderTarget->SizeY,
                        ERGBFormat::BGRA,
                        8
                    ))
                {
                    CompressedPng = PngWrapper->GetCompressed(100);
                    bCapturedFrame = CompressedPng.Num() > 0;
                }
            }
        }
    }

    if (!bCapturedFrame)
    {
        UE_LOG(LogTakeOne, Warning, TEXT("Shot %d of '%s' produced no pixels; skipping upload."), Index, *ActiveFilmId);
    }
    else
    {
        const FString Encoded = FBase64::Encode(CompressedPng.GetData(), static_cast<uint32>(CompressedPng.Num()));

        const FString BaseUrl = TEXT("http://127.0.0.1:8788");
        const FString Payload = FString::Printf(
            TEXT("{\"film_id\":\"%s\",\"index\":%d,\"width\":%d,\"height\":%d,\"data\":\"%s\"}"),
            *ActiveFilmId,
            Index,
            1280,
            720,
            *Encoded
        );

        FHttpRequestPtr Request = FHttpModule::Get().CreateRequest();
        Request->SetURL(BaseUrl + TEXT("/v1/films/shots"));
        Request->SetVerb(TEXT("POST"));
        Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
        Request->SetTimeout(20.0f);
        Request->SetContentAsString(Payload);
        Request->ProcessRequest();
        UE_LOG(LogTakeOne, Log, TEXT("Uploaded shot %d (%.1f KB png) for '%s'."), Index, CompressedPng.Num() / 1024.0f, *ActiveFilmId);
    }

    ShotIndex += 1;
    if (ShotIndex < ShotTotal)
    {
        GetWorld()->GetTimerManager().SetTimerForNextTick(
            FTimerDelegate::CreateUObject(this, &ATakeOneSceneBuilder::CaptureCurrentShot)
        );
    }
    else
    {
        FinishShoot();
    }
}

void ATakeOneSceneBuilder::FinishShoot()
{
    if (DirectorCamera)
    {
        DirectorCamera->SetActorTransform(OriginalCameraTransform);
    }
    UE_LOG(LogTakeOne, Log, TEXT("Shoot complete for '%s'."), *ActiveFilmId);
    ShotIndex = 0;
    ShotTotal = 0;
}
