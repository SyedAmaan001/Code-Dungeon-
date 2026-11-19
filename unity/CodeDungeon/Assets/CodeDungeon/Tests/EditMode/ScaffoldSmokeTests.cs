using System.Linq;
using NUnit.Framework;
using UnityEditor;

namespace CodeDungeon.Tests.EditMode
{
    public class ScaffoldSmokeTests
    {
        private const string BootPath = "Assets/CodeDungeon/Scenes/Boot.unity";
        private const string OvergrownGatePath = "Assets/CodeDungeon/Scenes/OvergrownGate.unity";

        [Test]
        public void BootAndOvergrownGateScenesExistAndAreFirstInBuildOrder()
        {
            Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>(BootPath), Is.Not.Null, BootPath);
            Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>(OvergrownGatePath), Is.Not.Null, OvergrownGatePath);

            var enabledScenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            Assert.That(enabledScenes, Is.EqualTo(new[] { BootPath, OvergrownGatePath }));
        }
    }
}
