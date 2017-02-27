/**
 * Created by Eduard on 2/25/2017.
 *
 * 'Egg' language interpreter.
 *
 * Parse structure
 * -------------------------------
 * Three basic structures:
 * value - string or number         : {type: "value", value: <value>}
 * word  - symbolic variable name   : {type: "word", name: <name>}
 * apply - function                 : {type: "apply", operator {type: "word", name: <func name>}, args: [{<arg list>}]}
 *
 * Egg Example Code:
 * >(x, 5)
 *
 * Parse tree:
 * {
 *  type: "apply",
 *  operator: {type: "word", name: ">"}
 *  args: [
 *      {type: "word", name: "x"],
 *      {type: "value", value: 5}
 *  ]
 * }
 *
 * Egg Language Elements
 * -------------------------------
 * Egg uses lexical scoping similar to Javascript.
 * Lines preceded by '#' are comments.
 *
 * do(<code block>)                     - Code blocks must be wrapped in do() to execute multiple lines.
 * define(<var>, <val>)                 - Defines var in current scope and sets it to val.
 * set(<var>, <val>)                    - Sets var in nearest accessible scope to val
 *                                      - throws Reference error if var hasn't been defined.
 * if(<test>, <trueVal>, <falseVal>)    - Returns arg1 if test evaluates to true else returns arg2.
 * while(<test>, <body>)                - Loops body as long as test evaluates to true.
 * fun(<arg1>, ..., <argN>, <body>)     - Defines a new function with a variable number of arguments and runs body.
 * true                                 - Representation of true value in Egg environment.
 * false                                - Representation of false value in Egg environment.
 * +(a, b)                              - Returns a + b.
 * -(a, b)                              - Returns a - b.
 * *(a, b)                              - Returns a * b.
 * /(a, b)                              - Returns a / b.
 * ==(a, b)                             - Returns true if a is equal to b, else returns false.
 * <(a, b)                              - Returns true if a is less than b, else returns false.
 * >(a, b)                              - Returns true if a is greater than b, else returns false.
 * print(<val>)                         - Logs val to the console.
 * array(<arg1>, ..., <argN>)           - Returns an array populated by the argument list.
 * length(<array>)                      - Returns length of array argument.
 * element(<array>, <n>)                - Returns value at index n of array argument.
 */

function parseExpression(program) {
    program = skipSpace(program);
    var match, expr;
    if (match = /^"([^"]*)"/.exec(program)) // Match a string
        expr = {type: "value", value: match[1]};
    else if (match = /^\d+\b/.exec(program))    // Match a number
        expr = {type: "value", value: Number(match[0])};
    else if (match = /^[^\s(),"]+/.exec(program)) // Match a symbol
        expr = {type: "word", name: match[0]};
    else
        throw new SyntaxError("Unexpected syntax: " + program);

    return parseApply(expr, program.slice(match[0].length));
}

function skipSpace(string) {
    var skippable = string.match(/^(\s|#.*)*/);
    return string.slice(skippable[0].length);
}

function parseApply(expr, program) {
    program = skipSpace(program);
    if (program[0] != "(")
        return {expr: expr, rest: program};

    program = skipSpace(program.slice(1));
    expr = {type: "apply", operator: expr, args: []};
    while (program[0] != ")") {
        var arg = parseExpression(program);
        expr.args.push(arg.expr);
        program = skipSpace(arg.rest);
        if (program[0] == ",")
            program = skipSpace(program.slice(1));
        else if (program[0] != ")")
            throw new SyntaxError("Expected ',' or ')'");
    }

    return parseApply(expr, program.slice(1));
}

function parse(program) {
    var result = parseExpression(program);
    if (skipSpace(result.rest).length > 0)
        throw new SyntaxError("Unexpected text after program");
    return result.expr;
}

function evaluate(expr, env) {
    switch(expr.type) {
        case "value":
            return expr.value;

        case "word":
            if (expr.name in env)
                return env[expr.name];
            else
                throw new ReferenceError("Undefined variable: " + expr.name);

        case "apply":
            if (expr.operator.type == "word" && expr.operator.name in specialForms)
                return specialForms[expr.operator.name](expr.args, env);

            var op = evaluate(expr.operator, env);
            if (typeof op != "function")
                throw new TypeError("Applying a non-function.");
            return op.apply(null, expr.args.map(function(arg) {
                return evaluate(arg, env);
            }));
    }
}

var specialForms = Object.create(null);

specialForms["if"] = function(args, env) {
    if (args.length != 3)
        throw new SyntaxError("Bad number of args to if");

    if (evaluate(args[0], env) !== false)
        return evaluate(args[1], env);
    else
        return evaluate(args[2], env);
};

specialForms["while"] = function(args, env) {
    if (args.length != 2)
        throw new SyntaxError("Bad number of args to while");

    while (evaluate(args[0], env) !== false)
        evaluate(args[1], env);

    return false;
};

specialForms["do"] = function (args, env) {
    var value = false;

    args.forEach(function(arg) {
        value = evaluate(arg, env);
    });

    return value;
};

specialForms["define"] = function(args, env) {
    if (args.length != 2 || args[0].type != "word")
        throw new SyntaxError("Bad use of define");

    var value = evaluate(args[1], env);

    env[args[0].name] = value;

    return value;
};

var globalEnv = Object.create(null);

globalEnv["true"] = true;
globalEnv["false"] = false;

["+", "-", "*", "/", "==", "<", ">"].forEach(function(op) {
    globalEnv[op] = new Function("a, b", "return a " + op + " b;");
});

globalEnv["print"] = function(value) {
    console.log(value);
    return value;
};

function run() {
    var env = Object.create(globalEnv);
    var program = Array.prototype.slice.call(arguments, 0).join("\n");
    return evaluate(parse(program), env);
}

specialForms["fun"] = function(args, env) {
    if (!args.length)
        throw new SyntaxError("Functions need a body");

    function name(expr) {
        if (expr.type != "word")
            throw new SyntaxError("Arg names must be words");
        return expr.name;
    }

    var argNames = args.slice(0, args.length - 1).map(name);
    var body = args[args.length - 1];

    return function() {
        if (arguments.length != argNames.length)
            throw new TypeError("Wrong number of arguments");
        var localEnv = Object.create(env);

        for (var i = 0; i < arguments.length; i++)
            localEnv[argNames[i]] = arguments[i];
        return evaluate(body, localEnv);
    };
};

globalEnv["array"] = function() {
    return Array.prototype.slice.call(arguments, 0);
};

globalEnv["length"] = function(array) {
    if(!Array.isArray(array))
        throw new TypeError("Argument to length function not an array.");

    return array.length;
};

globalEnv["element"] = function(array, n) {
    if(!Array.isArray((array)))
        throw new TypeError("Array argument to element function not an array.");
    else if(typeof n != "number")
        throw new TypeError("Index argument to element function not a number.");
    return array[n];
};

specialForms["set"] = function(args, env) {
    if(args.length != 2 || args[0].type != "word")
        throw new SyntaxError("Bad use of set");

    var value = evaluate(args[1], env);

    while(env && !(Object.prototype.hasOwnProperty.call(env, args[0].name)))
        env = Object.getPrototypeOf(env);

    if(env == null)
        throw new ReferenceError("Variable cannot be set if it hasn't been defined.");

    env[args[0].name] = value;

    return value;
};


run("#Egg program to test basic language functionality",
    "#Prints the sum of 1-10",
    "do(define(total, 0),",
    "   define(count, 1),",
    "   while(<(count, 11),",
    "       do(define(total, +(total, count)),",
    "           define(count, +(count, 1)))),",
    "   print(total))",
    "#Output: 55");

run("#Egg program to test function definition",
    "#Defines plusOne function and prints plusOne(10)",
    "do(define(plusOne, fun(a, +(a, 1))),",
    "   print(plusOne(10)))",
    "#Output: 11");

run("#Egg program to test function definition with recursive call to self",
    "#Defines pow function and prints pow(2, 10) -- 2^10.",
    "do(define(pow, fun(base, exp,",
    "   if(==(exp, 0),",
    "       1,",
    "       *(base, pow(base, -(exp, 1)))))),",
    "   print(pow(2, 10)))",
    "#Output: 1024");

run("#Egg program to test array functionality",
    "#Prints sum of array provided to sum(array) function",
    "do(define(sum, fun(array,",
    "       do(define(i, 0),",
    "          define(sum, 0),",
    "          while(<(i, length(array)),",
    "               do(define(sum, +(sum, element(array, i))),",
    "                   define(i, +(i, 1)))),",
    "               sum))),",
    "   print(sum(array(1, 2, 3))))",
    "#Output: 6");

run("#Egg program to test set functionality",
    "#Sets the value of x which is outside of the setx function's local scope.",
    "do(define(x, 4),",
    "   define(setx, fun(val, set(x, val))),",
    "   setx(50),",
    "   print(x))",
    "#Output: 50");

run("#Egg program to test that Reference error is thrown properly when set is misused",
    "#Attempts to set a variable that hasn't been defined.",
    "set(quux, true)",
    "#Output: Uncaught reference error.");