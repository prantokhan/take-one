using UnrealBuildTool;

public class TakeOne : ModuleRules
{
    public TakeOne(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(
            new[]
            {
                "Core",
                "CoreUObject",
                "Engine",
                "HTTP",
                "InputCore",
                "Json",
                "UMG"
            }
        );

        PrivateDependencyModuleNames.AddRange(
            new[]
            {
                "CinematicCamera",
                "DeveloperSettings",
                "ImageWrapper",
                "RenderCore",
                "Slate",
                "SlateCore"
            }
        );
    }
}
