#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "TakeOneSceneJson.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FTakeOneSceneJsonValidTest,
    "TakeOne.SceneGeneration.ValidSceneJson",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter
)

bool FTakeOneSceneJsonValidTest::RunTest(const FString& Parameters)
{
    const FString Json = TEXT(R"JSON(
    {
      "schema_version": "1.0",
      "title": "Automation Stage",
      "summary": "A generated test stage.",
      "environment": {
        "ground_color": "#101214",
        "sky_light_color": "#5A7188",
        "sky_light_intensity": 1.0,
        "sun_color": "#FFD4AD",
        "sun_intensity": 5.0,
        "sun_rotation": { "pitch": -35, "yaw": -30, "roll": 0 },
        "fog_density": 0.01
      },
      "camera": {
        "location": { "x": -1200, "y": -800, "z": 500 },
        "rotation": { "pitch": -10, "yaw": 30, "roll": 0 },
        "fov": 50
      },
      "objects": [
        {
          "id": "hero_block",
          "label": "Hero block",
          "primitive": "cube",
          "location": { "x": 0, "y": 0, "z": 100 },
          "rotation": { "pitch": 0, "yaw": 15, "roll": 0 },
          "scale": { "x": 2, "y": 3, "z": 1 },
          "color": "#A45A32",
          "cast_shadow": true,
          "asset_hint": "original hero prop"
        }
      ]
    }
    )JSON");

    FTakeOneSceneSpec Scene;
    FString Error;
    TestTrue(TEXT("Valid scene JSON parses"), FTakeOneSceneJson::DeserializeScene(Json, Scene, Error));
    TestEqual(TEXT("Scene title is preserved"), Scene.Title, FString(TEXT("Automation Stage")));
    TestEqual(TEXT("One object is produced"), Scene.Objects.Num(), 1);
    TestEqual(TEXT("Primitive is parsed"), Scene.Objects[0].Primitive, ETakeOnePrimitiveType::Cube);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FTakeOneSceneJsonRejectsVersionTest,
    "TakeOne.SceneGeneration.RejectsUnsupportedSchema",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter
)

bool FTakeOneSceneJsonRejectsVersionTest::RunTest(const FString& Parameters)
{
    const FString Json = TEXT(R"JSON({
      "schema_version": "2.0",
      "title": "Future scene",
      "summary": "",
      "environment": {},
      "camera": {},
      "objects": []
    })JSON");

    FTakeOneSceneSpec Scene;
    FString Error;
    TestFalse(TEXT("Unsupported schema is rejected"), FTakeOneSceneJson::DeserializeScene(Json, Scene, Error));
    TestTrue(TEXT("A useful version error is returned"), Error.Contains(TEXT("Unsupported scene schema")));
    return true;
}

#endif
