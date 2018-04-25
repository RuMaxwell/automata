/*
 * Parse regexes to s-object for convience of later converting them to automata.
 * s-object means a tree-like list that if traversed inorderedly, will produce the same string as the regex.
 * 
 * Example:
 * (0+1)*1*(0+1+2) => (0+1)*1(0+1+2) => '(- (* (+ 0 1)) (* 1) (+ (+ 0 1) 2))'
 *  => ['-', ['-', ['*', ['+', '0', '1']], ['*', '1']], ['+', ['+', '0', '1'], '2']]
 * 
 * How it works:
 *  This parser bases on two stacks, one is for the operators, the other is for the operands.
 *  When working, it scans the regex string. Whenever it comes up with:
 *    '('         => Directly push it to the operand stack.
 *    [0-9a-zA-Z] => Considered as a symbol, push it to the operand stack.
 *    '+'         => Push it to the operator stack.
 *    '*'         => Pop the operand stack, quote the popped string with (*) and push it
 *                   back to the operand stack.
 *    ')'         => Pop the operand stack until the first '(' is popped. Check how many
 *                   operands have been popped. Then pop the operator stack, see if the
 *                   number of operands match the popped operator. If is, quote the ope-
 *                   rands with the operator and push it back to the operand stack. If
 *                   isn't, strip the parentheses and then push the original operands
 *                   back to the operand stack.
 *  Each time the operator stack is pushed, a check will be made. This can find syntax
 *    mistakes instantly.
 *  When it scans to the end of the regex string, a check will be made. If the operator stack
 *    is null and the operand stack contains no parentheses, the operands will be finally
 *    quoted by concatination operator.
 */

/**
 * Add '-' between the consecutive parts and parentheses to make clear the operator priority ( * > - > + )
 * e.g. '(00+01)+1*(0+1)' => '(0-0+0-1)+1*-(0+1)' => '((0-0)+(0-1))+(1*-(0+1))'
 * 
 * @param {string} regex The regex
 * @returns {string} The modified regex
 */
function regex_justify(regex) {
  const is_oprtor = char => {
    return (char === ',' || char === '*' || char === '+'
         || char === '(' || char === ')' || char === '#');
  };

  // Remove whitespaces from the regex and add a terminate symbol to the end
  regex = (() => {
    let res = '';
    for (let i = 0; i < regex.length; i++) {
      if (regex[i] !== ' ' &&  regex[i] !== '\t' && regex[i] !== '\n' && regex[i] !== '\r') {
        res += regex[i];
      }
    }
    return res + '#';
  })();

  const insertConcat = (str, i) => str.slice(0, i + 1) + ',' + str.slice(i + 1);
  for (let i = 0; i < regex.length - 1; i++) {
    if ((is_symbol(regex[i]) && is_symbol(regex[i + 1]))
    || (is_symbol(regex[i]) && regex[i + 1] === '(')
    || (regex[i] === ')' && is_symbol(regex[i + 1]))
    || (regex[i] === ')' && regex[i + 1] === '(')
    || (regex[i] === '*' && is_symbol(regex[i + 1]))
    || (regex[i] === '*' && regex[i + 1] === '(')) {
      regex = insertConcat(regex, i);
    }
  };

  var oprt_id = {
    '+': 0,
    ',': 1,
    '*': 2,
    '(': 3,
    ')': 4,
    '#': 5
  };

  var priorityTable = [
  // +  ,  *  (  )  #
    [1, 2, 2, 2, 1, 1], // +
    [1, 1, 2, 2, 1, 1], // ,
    [1, 1, 1, 2, 1, 1], // *
    [2, 2, 2, 2, 3, 0], // (
    [1, 1, 1, 0, 1, 1], // )
    [2, 2, 2, 2, 0, 3]  // #
  ];

  const getPriority = (oprt1, oprt2) => priorityTable[oprt_id[oprt1]][oprt_id[oprt2]];

  regex = (() => {
    let m = [ '#' ];
    let n = [];
    const top = lst => lst[lst.length - 1];

    const dealWithOprt = (op) => {
      if (op === '+' || op === ',') {
        let b = n.pop();
        let a = n.pop();
        return `(${op} ${a} ${b})`;
      }
      else if (op === '*') {
        let a = n.pop();
        return `(* ${a})`;
      }
    };

    let i = 0;
    while (regex[i] !== '#' || top(m) !== '#') {
      if (is_symbol(regex[i])) {
        n.push(regex[i]);
        i++;
      }
      else if (is_oprtor(regex[i])) {
        let cur = top(m);
        let prio = getPriority(cur, regex[i]);
        if (prio === 0) {
          console.error("Syntax error in regex.");
          i++;
        }
        else if (prio === 1) {
          n.push(dealWithOprt(cur));
          m.pop();
        }
        else if (prio === 2) {
          m.push(regex[i]);
          i++;
        }
        else if (prio === 3) {
          m.pop();
          i++;
        }
      }
    }

    return top(n);
  })();

  return regex;
}

/**
 * Parse a given regex to s-expression
 * 
 * @param {string} regex The regex
 * @returns {Array} s-object
 */
function regex_parse(regex) {
  const is_oprtor = char => {
    return (char === '-' || char === '*' || char === '+');
  };

  var oprtor_stack = [];
  var oprand_stack = [];
  var operator = '';
  var oprds = [];

  var phcnt = 0;

  var s_obj = [];

  for (var i = 0; i < regex.length; i++) {
    if (regex[i] === '(') {
      phcnt++;
    }
    else if (regex[i] === ')') {
      phcnt--;
      operator = oprtor_stack.pop();
      if (operator == '+') {
        oprds = [oprand_stack.pop(), oprand_stack.pop()];
        // Generate string "['+', operand1, operand2]"
        var selector = `[\'+\', ${[...oprds]}]`;
        oprand_stack.push(`${selector}`);
      }
    }
    else if (is_symbol(regex[i])) {
      oprand_stack.push(regex[i]);
    }
    else if (is_oprtor(regex[i])) {
      oprtor_stack.push(regex[i]);
    }
    else {
      console.error('Regex parser error: cannot resolve symbol \'' + regex[i] + '\'');
    }
  }
}
