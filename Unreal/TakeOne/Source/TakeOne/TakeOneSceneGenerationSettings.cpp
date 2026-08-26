#include "TakeOneSceneGenerationSettings.h"

UTakeOneSceneGenerationSettings::UTakeOneSceneGenerationSettings()
{
    SectionName = TEXT("SceneGeneration");
}

FName UTakeOneSceneGenerationSettings::GetCategoryName() const
{
    return TEXT("Take One");
}
