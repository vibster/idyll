
var expect = require('expect.js');
var Lexer = require('../src/lexer');
var parse = require('../src/parser');
var fs = require('fs');

describe('compiler', function() {

  describe('lexer', function() {
    it('should tokenize the input', function() {
      var lex = Lexer();
      var results = lex("Hello \n\nWorld! []");
      expect(results.tokens).to.eql("WORDS TOKEN_VALUE_START \"Hello \" TOKEN_VALUE_END BREAK WORDS TOKEN_VALUE_START \"World! \" TOKEN_VALUE_END OPEN_BRACKET CLOSE_BRACKET EOF");
    });

    it('should tokenize the input with a complex component', function() {
      var lex = Lexer();
      var results = lex("Hello \n\nWorld! \n\n [VarDisplay var:v work:\"no\" /]");
      expect(results.tokens).to.eql("WORDS TOKEN_VALUE_START \"Hello \" TOKEN_VALUE_END BREAK WORDS TOKEN_VALUE_START \"World! \" TOKEN_VALUE_END BREAK OPEN_BRACKET COMPONENT_WORD TOKEN_VALUE_START \"VarDisplay\" TOKEN_VALUE_END COMPONENT_WORD TOKEN_VALUE_START \"var\" TOKEN_VALUE_END PARAM_SEPARATOR COMPONENT_WORD TOKEN_VALUE_START \"v\" TOKEN_VALUE_END COMPONENT_WORD TOKEN_VALUE_START \"work\" TOKEN_VALUE_END PARAM_SEPARATOR STRING TOKEN_VALUE_START \"&quot;no&quot;\" TOKEN_VALUE_END FORWARD_SLASH CLOSE_BRACKET EOF");
    });

    it('should recognize headings', function() {
      var lex = Lexer();
      var results = lex("\n## my title");
      expect(results.tokens).to.eql('HEADER_2 TOKEN_VALUE_START "my title" TOKEN_VALUE_END EOF');
    });
    it('should handle newlines', function() {
      var lex = Lexer();
      var results = lex("\n\n\n\n text \n\n");
      expect(results.tokens.split(' ')).to.eql(['WORDS', 'TOKEN_VALUE_START', '\"text\"', 'TOKEN_VALUE_END', 'EOF']);
    });

    it('should handle backticks in a paragraph', function() {
      var lex = Lexer();
      var results = lex("regular text and stuff, then some `code`");
      expect(results.tokens).to.eql('WORDS TOKEN_VALUE_START "regular text and stuff, then some " TOKEN_VALUE_END BACKTICK WORDS TOKEN_VALUE_START "code" TOKEN_VALUE_END BACKTICK EOF');
    });

  });

  describe('parser', function() {
    it('should parse a simple string', function() {
      var input = 'Just a simple string';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([['p', [], ['Just a simple string']]]);
    });
    it('should handle multiple blocks', function() {
      var input = 'Just a simple string \n\n with some whitespace';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([['p', [], ['Just a simple string ']], ['p', [], ['with some whitespace']]]);
    });
    it('should parse a closed component', function() {
      var input = '[var /]';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([['var', [], []]]);
    });
    it('should parse a closed component', function() {
      var input = '[var name:"v1" value:5 /]\n\nJust a simple string plus a component \n\n [VarDisplay var:v1 /]';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([['var', [['name', ['value', 'v1']], ['value', ['value', 5]]], []], ['p', [], ['Just a simple string plus a component ']], ['VarDisplay', [['var', ['variable', 'v1']]] , []]]);
    });

    it('should parse an open component', function() {
      var input = '[Slideshow currentSlide:1]test test test[/Slideshow]';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
    });

    it('should parse a nested component', function() {
      var input = '[Slideshow currentSlide:1]text and stuff \n\n lots of newlines.\n\n[OpenComponent key:"val" ][/OpenComponent][/Slideshow]';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['Slideshow', [['currentSlide', ['value', 1]]],
            [
              ["p", [], ["text and stuff "]],
              ["p", [], ["lots of newlines."]],
              ["OpenComponent", [["key", ["value", "val"]]], []]
      ]]]);
    });
    it('should handle an inline closed component', function() {
      var input = 'This is a normal text paragraph that [VarDisplay var:var /] has a component embedded in it.';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([
        ['p', [], [
          'This is a normal text paragraph that ',
          ['VarDisplay', [['var', ['variable', 'var']]], []],
          ' has a component embedded in it.'
        ]]]);
    });

    it('should handle a header', function() {
      var input = '## This is a header\n\n And this is a normal paragraph.';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql([
        ['h2', [], [
          'This is a header']
        ],['p', [], [
          ' And this is a normal paragraph.']
        ],
      ]);
    });

    it('should parse an open component with a break at the end', function() {
      var input = '[Slideshow currentSlide:1]text and stuff \n\n [/Slideshow]';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['Slideshow', [['currentSlide', ['value', 1]]],
            [
              "text and stuff "
            ]
          ]
      ]);
    });
    it('should parse a paragraph and code fence', function() {
      var input = 'text text text lots of text\n\n\n```\nvar code = true;\n```\n';
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['p', [], ['text text text lots of text']],
          ['pre', [], [['code', [], ['var code = true;']]]]
        ]);
    });
    it('should handle backticks in a paragraph', function() {
      var input = "regular text and stuff, then some `code`";
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['p', [], ['regular text and stuff, then some ', ['code', [], ['code']]]]
        ]);
    });



    // it('should handle italics and bold', function() {
    //   const input = "regular text and stuff, then some *italics* and some **bold**.";
    //   var lex = Lexer();
    //   var lexResults = lex(input);
    //   var output = parse(input, lexResults.tokens, lexResults.positions);
    //   expect(output).to.eql(
    //     [
    //       ['p', [], ['regular text and stuff, then some ', ['em', [], ['italics']], ' and some ', ['strong', [], ['bold']], '.']]
    //     ]);
    // });

    it('should accept negative numbers', function() {
      var input = "[component prop:-10 /]";
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['component', [['prop', ['value', -10]]], []]
        ]);

    });

    it('should accept positive numbers', function() {
      var input = "[component prop:10 /]";
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);
      expect(output).to.eql(
        [
          ['component', [['prop', ['value', 10]]], []]
        ]);

    });

    it('should handle booleans', function() {
      const input = "[component prop:true /]";
      var lex = Lexer();
      var lexResults = lex(input);
      var output = parse(input, lexResults.tokens, lexResults.positions);      
      expect(output).to.eql(
        [
          ['component', [['prop', ['value', true]]], []]
        ]);
      });

      it('should handle booleans in backticks', function() {
        const input = "[component prop:`true` /]";
        var lex = Lexer();
        var lexResults = lex(input);
        var output = parse(input, lexResults.tokens, lexResults.positions);
        expect(output).to.eql(
          [
            ['component', [['prop', ['expression', 'true']]], []]
          ]);
      });

      it('should handle unordered list', function() {
        const input = "* this is the first list\n* this is the second list";
        var lex = Lexer();
        var lexResults = lex(input);
        console.log(lexResults);
        var output = parse(input, lexResults.tokens, lexResults.positions);
        expect(output).to.eql(
          [
            ['ul', [], 
              ['li', [], ['this is the first list']], 
              ['li', [], ['this is the second list']]
            ],
          ]);
      });
      
      it('should handle ordered list', function() {
        const input = "1. this is the first list\n2. this is the second list";
        var lex = Lexer();
        var lexResults = lex(input);
        console.log(lexResults);
        var output = parse(input, lexResults.tokens, lexResults.positions);
        console.log(output);
        expect(output).to.eql(
          [
            ['ol', [], 
              ['li', [], ['this is the first list']],
              ['li', [], ['this is the second list']]
            ]
          ]);
      });

  });



  describe('error handling', function() {
    it('record line and column number of an error', function() {
      input = 'This string contains an un-closed component [BadComponent key:"val" ] ';
      var lex = Lexer();
      var lexResults = lex(input);
      try {
        var output = parse(input, lexResults.tokens, lexResults.positions);
      } catch(err) {
        expect(err.row).to.be(1);
        expect(err.column).to.be(70);
      }
    });
  });
});
