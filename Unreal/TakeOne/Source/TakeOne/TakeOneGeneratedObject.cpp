#include "TakeOneGeneratedObject.h"

#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
const TCHAR* MeshPathForPrimitive(const ETakeOnePrimitiveType Primitive)
{
    switch (Primitive)
    {
    case ETakeOnePrimitiveType::Sphere:
        return TEXT("/Engine/BasicShapes/Sphere.Sphere");
    case ETakeOnePrimitiveType::Cylinder:
        return TEXT("/Engine/BasicShapes/Cylinder.Cylinder");
    case ETakeOnePrimitiveType::Cone:
        return TEXT("/Engine/BasicShapes/Cone.Cone");
    case ETakeOnePrimitiveType::Cube:
    default:
        return TEXT("/Engine/BasicShapes/Cube.Cube");
    }
}
}

ATakeOneGeneratedObject::ATakeOneGeneratedObject()
{
    PrimaryActorTick.bCanEverTick = false;

    MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("GeneratedMesh"));
    SetRootComponent(MeshComponent);
    MeshComponent->SetMobility(EComponentMobility::Movable);
    MeshComponent->SetCollisionProfileName(TEXT("BlockAll"));
    Tags.Add(TEXT("TakeOne.Generated"));
}

void ATakeOneGeneratedObject::InitializeFromSpec(const FTakeOneSceneObjectSpec& Spec)
{
    SourceSpec = Spec;
    Tags.AddUnique(Spec.Id);

    if (UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, MeshPathForPrimitive(Spec.Primitive)))
    {
        MeshComponent->SetStaticMesh(Mesh);
    }

    MeshComponent->SetCastShadow(Spec.bCastShadow);
    SetActorLocationAndRotation(Spec.Location, Spec.Rotation);
    SetActorScale3D(Spec.Scale);

    if (UMaterialInterface* BaseMaterial = LoadObject<UMaterialInterface>(
        nullptr,
        TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")
    ))
    {
        DynamicMaterial = UMaterialInstanceDynamic::Create(BaseMaterial, this);
        if (DynamicMaterial)
        {
            DynamicMaterial->SetVectorParameterValue(TEXT("Color"), Spec.Color);
            DynamicMaterial->SetVectorParameterValue(TEXT("BaseColor"), Spec.Color);
            MeshComponent->SetMaterial(0, DynamicMaterial);
        }
    }

#if WITH_EDITOR
    SetActorLabel(Spec.Label.IsEmpty() ? Spec.Id.ToString() : Spec.Label);
#endif
}
