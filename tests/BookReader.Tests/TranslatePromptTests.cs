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
    public void Prompt_asks_for_native_and_literal_lines_without_extras()
    {
        var prompt = TranslatePrompt.Build("x", "German");

        Assert.Contains("No preface", prompt);
        Assert.Contains("Native:", prompt);
        Assert.Contains("Literal:", prompt);
        Assert.DoesNotContain("translation only", prompt);
    }
}
