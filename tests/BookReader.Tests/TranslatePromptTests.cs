using BookReader.Core.Llm;

namespace BookReader.Tests;

public class TranslatePromptTests
{
    [Fact]
    public void Prompt_names_target_language_and_contains_the_trimmed_text()
    {
        var prompt = TranslatePrompt.Build("  break the ice \n", "Ukrainian");

        Assert.Contains("into Ukrainian", prompt);
        Assert.Contains("<text>\nbreak the ice\n</text>", prompt.ReplaceLineEndings("\n"));
    }

    [Fact]
    public void Prompt_asks_for_translation_only()
    {
        Assert.Contains("Reply with the translation only", TranslatePrompt.Build("x", "German"));
    }
}
