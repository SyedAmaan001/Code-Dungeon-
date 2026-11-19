// Scaffold marker (T-04): gives the CodeDungeon.Runtime.Presentation assembly a source file so it compiles
// and can be referenced by tests. Gameplay code arrives in later tasks.
using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("CodeDungeon.Tests.EditMode")]
[assembly: InternalsVisibleTo("CodeDungeon.Tests.PlayMode")]
