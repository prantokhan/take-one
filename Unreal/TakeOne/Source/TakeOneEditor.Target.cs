using UnrealBuildTool;
using System.Collections.Generic;

public class TakeOneEditorTarget : TargetRules
{
    public TakeOneEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("TakeOne");
    }
}
