using UnrealBuildTool;
using System.Collections.Generic;

public class TakeOneTarget : TargetRules
{
    public TakeOneTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("TakeOne");
    }
}
