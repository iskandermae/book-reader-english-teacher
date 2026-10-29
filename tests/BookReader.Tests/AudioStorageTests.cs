using BookReader.Core.Audio;
using Microsoft.Extensions.Logging.Abstractions;

namespace BookReader.Tests;

public sealed class AudioStorageTests : IDisposable
{
    private readonly string _folder = Path.Combine(Path.GetTempPath(), "bookreader-tests-" + Guid.NewGuid());

    public void Dispose() => Directory.Delete(_folder, true);

    /// <summary>Delivers some bytes, then fails like an aborted upload.</summary>
    private sealed class AbortingStream : MemoryStream
    {
        public AbortingStream() : base(new byte[100]) { }
        public override int Read(byte[] buffer, int offset, int count) => throw new IOException("aborted");
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => throw new IOException("aborted");
    }

    [Fact]
    public async Task Failed_copy_leaves_no_partial_file()
    {
        var storage = new AudioStorage(_folder, NullLogger<AudioStorage>.Instance);

        await Assert.ThrowsAsync<IOException>(() => storage.SaveAsync(new AbortingStream(), ".mp3", CancellationToken.None));

        Assert.Empty(Directory.GetFiles(storage.Folder));
    }
}
