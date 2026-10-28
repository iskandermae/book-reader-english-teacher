using BookReader.Core.Llm;

namespace BookReader.Tests;

public class PromptTemplateTests
{
    private static PromptValues Values(string selection = " sel ", string? sentence = " sen ", string? paragraph = " par ") =>
        new(selection, sentence, paragraph, "Ukrainian", "English");

    [Fact]
    public void Fill_replaces_all_placeholders_and_trims_values()
    {
        var result = PromptTemplate.Fill(
            "{selection}|{sentence}|{paragraph}|{native_language}|{target_language}|{from_language}|{selection}", Values());

        Assert.Equal("sel|sen|par|Ukrainian|Ukrainian|English|sel", result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public void Fill_gives_empty_string_for_missing_sentence_and_paragraph(string? empty)
    {
        Assert.Equal("[][]", PromptTemplate.Fill("[{sentence}][{paragraph}]", Values(sentence: empty, paragraph: empty)));
    }

    [Fact]
    public void Fill_is_single_pass_and_keeps_unknown_text()
    {
        var result = PromptTemplate.Fill("{selection} {sentence} {unknown} { } {{x}", Values(selection: "{sentence}", sentence: "{selection}"));

        Assert.Equal("{sentence} {selection} {unknown} { } {{x}", result);
    }

    [Fact]
    public void Validate_accepts_known_placeholders_with_selection()
    {
        Assert.Empty(PromptTemplate.Validate("{selection} {sentence} {paragraph} {native_language} {target_language} {from_language}"));
    }

    [Fact]
    public void Validate_reports_unknown_placeholder_and_missing_selection()
    {
        var errors = PromptTemplate.Validate("Translate {text} and {text}");

        Assert.Equal(2, errors.Count);
        Assert.Contains("{text}", errors[0]);
        Assert.Contains("{selection}", errors[1]);
    }

    [Fact]
    public void Default_templates_are_valid()
    {
        Assert.Empty(PromptTemplate.Validate(TranslatePrompt.DefaultTemplate));
        Assert.Empty(PromptTemplate.Validate(ExplainPrompt.DefaultTemplate));
    }

    [Fact]
    public void Default_translate_template_gives_the_pre_template_prompt()
    {
        var prompt = PromptTemplate.Fill(TranslatePrompt.DefaultTemplate, Values("  break the ice \n", "ignored", "ignored")).ReplaceLineEndings("\n");

        Assert.Equal(
            "Translate the text between the <text> tags into Ukrainian.\n" +
            "Translate only that text. No preface, no quotes, no notes, no explanations. Reply in exactly two lines:\n" +
            "Native: [translation, as native speakers would say]\n" +
            "Literal: [translation, Перекладай максимально близько до оригіналу, але зберігай зміст, не перекладай дослівно окремі слова. Для ідіом і фразових конструкцій показуй буквальний зміст у примітках у дужках. Мета перекладу - допомогти зрозуміти англійське формулювання, як вони думають.]\n" +
            "\n<text>\nbreak the ice\n</text>",
            prompt);
    }

    [Theory]
    [InlineData("They told a joke to break the ice.")]
    [InlineData(null)]
    public void Default_explain_template_asks_three_lines_and_works_with_or_without_sentence(string? sentence)
    {
        var prompt = PromptTemplate.Fill(ExplainPrompt.DefaultTemplate, Values("break the ice", sentence, null)).ReplaceLineEndings("\n");

        Assert.Contains("<text>\nbreak the ice\n</text>", prompt);
        Assert.Contains($"do not explain the sentence itself): {sentence}\n", prompt);
        Assert.Contains("simple English", prompt);
        Assert.Contains("Meaning:", prompt);
        Assert.Contains("Grammar:", prompt);
        Assert.Contains("Usage:", prompt);
    }
}
