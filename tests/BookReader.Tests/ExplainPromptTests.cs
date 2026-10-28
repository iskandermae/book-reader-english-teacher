using BookReader.Core.Llm;

namespace BookReader.Tests;

public class ExplainPromptTests
{
    [Fact]
    public void Prompt_contains_trimmed_text_and_context_and_asks_for_three_lines()
    {
        var prompt = ExplainPrompt.Build("  break the ice \n", " They told a joke to break the ice. ").ReplaceLineEndings("\n");

        Assert.Contains("<text>\nbreak the ice\n</text>", prompt);
        Assert.Contains("<context>\nThey told a joke to break the ice.\n</context>", prompt);
        Assert.Contains("simple English", prompt);
        Assert.Contains("No preface", prompt);
        Assert.Contains("Meaning:", prompt);
        Assert.Contains("Grammar:", prompt);
        Assert.Contains("Usage:", prompt);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public void Prompt_has_no_context_block_without_context(string? context)
    {
        Assert.DoesNotContain("<context>", ExplainPrompt.Build("x", context));
    }
}
