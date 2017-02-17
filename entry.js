const React = require('react');
const ReactDOM = require('react-dom');
const changeCase = require('change-case');
const htmlTags = require('html-tags');
const bulk = require('bulk-require');

// Require all of the components up front...
// this is not ideal!
const defaultComponents = bulk(process.env.IDYLL_PATH + '/components', [ '**/*.js' ]);
const customComponents = bulk(process.env.COMPONENTS_FOLDER, [ '**/*.js' ]);
const datasets = bulk(process.env.DATA_FOLDER, [ '**/*.json' ]);

let results = require(process.env.AST_FILE);


if (results.length) {
  console.log('Successfully parsed file.');
}

const COMPONENTS = {
  Variable: 'var',
  Dataset: 'data',
  Paragraph: 'p'
};

const PROPERTIES = {
  Expression: 'expression',
  Variable: 'variable',
  Value: 'value'
};

const VARIABLE = {
  Name: 'name',
  Value: 'value'
};

const DATASET = {
  Name: 'name',
  Source: 'source'
};

const processComponent = (name) => {
  const paramCaseName = changeCase.paramCase(name);
  let componentClass;
  const extraProps = {};

  if (customComponents[paramCaseName]) {
    componentClass = customComponents[paramCaseName];
  } else if (defaultComponents[paramCaseName]) {
    componentClass = defaultComponents[paramCaseName];
  } else if (htmlTags.indexOf(paramCaseName) > -1) {
    componentClass = paramCaseName;
  } else {
    componentClass = 'div';
    extraProps.className = name.toLowerCase();
  }

  return {
    componentClass,
    extraProps
  };
}


class InteractiveDocument extends React.Component {

  constructor(props) {
    super(props);
    this.handleUpdateProps = this.handleUpdateProps.bind(this);

    // Walk the tree, creating the proper components for evererything.
    this.bindings = {};
    const initialState = {};

    let nodeID = -1;
    const walkVars = (node) => {
      nodeID++;

      if (typeof node === 'string') {
        return;
      }

      const componentName = node[0];
      const props = node[1];
      const children = node[2];
      if (componentName === COMPONENTS.Dataset) {
        let varName, varVal;
        props.forEach((propArr) => {
          const propName = propArr[0];
          const propValueArr = propArr[1];
          switch (propName) {
            case DATASET.Name:
              varName = propValueArr[1];
              break;
            case DATASET.Source:
              varVal = datasets[propValueArr[1]];
              break;
          }
        });
        initialState[varName] = varVal;
      } else if (componentName === COMPONENTS.Variable) {
        let varName, varVal;
        props.forEach((propArr) => {
          const propName = propArr[0];
          const propValueArr = propArr[1];
          switch (propName) {
            case VARIABLE.Name:
              varName = propValueArr[1];
              break;
            case VARIABLE.Value:
              switch (propValueArr[0]) {
                case PROPERTIES.Value:
                  varVal = propValueArr[1];
                  break;
                case PROPERTIES.Variable:
                  varVal = initialState[propValueArr[1]];
                  break;
              }
          }
        });
        initialState[varName] = varVal;
      } else {
        const propsObj = {key: nodeID, __handleUpdateProps: this.handleUpdateProps(nodeID)};
        props.forEach((propArr) => {
          const propName = propArr[0];
          const propValueArr = propArr[1];
          if (propValueArr[0] === PROPERTIES.Variable) {
            if (!this.bindings[nodeID]) {
              this.bindings[nodeID] = {};
            }
            this.bindings[nodeID][propName] = propValueArr[1];
          }
        });

        if (children) {
          children.map(walkVars);
        }
      }
    };

    results.map(walkVars);
    this.state = initialState;

    nodeID = -1;
    const walkNode = (node) => {
      nodeID++;
      if (typeof node === 'string') {
        return node;
      }

      const componentName = node[0];
      const props = node[1];
      const children = node[2];
      if (componentName !== COMPONENTS.Variable && componentName !== COMPONENTS.Dataset) {
        const propsObj = {key: nodeID, __handleUpdateProps: this.handleUpdateProps(nodeID)};
        props.forEach((propArr) => {
          const propName = propArr[0];
          const propValueArr = propArr[1];
          if (propValueArr[0] === PROPERTIES.Variable) {
            propsObj[propName] = this.state[propValueArr[1]];
          } else if (propValueArr[0] === PROPERTIES.Expression) {
            let evalFunc = '(() => {';
            const relevantVars = [];
            const expression = propValueArr[1];
            Object.keys(this.state).forEach((propName) => {
              if (expression.indexOf(propName) === -1) {
                return;
              }
              relevantVars.push(propName);
              const val = this.state[propName];
              evalFunc += `var ${propName} = ${JSON.stringify(val)};\n`;
            });
            evalFunc += propValueArr[1];
            evalFunc += `\nthis.setState({${relevantVars.join(',')}});\n`;
            evalFunc += '})()';
            propsObj[propName] = (function() {
              eval(evalFunc);
            }).bind(this);
          } else {
            propsObj[propName] = propValueArr[1];
          }
        });

        const results = processComponent(componentName);
        const inputProps = Object.assign({}, results.extraProps, propsObj);
        if (children) {
          return React.createElement(results.componentClass, inputProps, children.length  ? children.map(walkNode) : null);
        }
        return React.createElement(getComponentClass(componentName), inputProps);
      }
    };

    this.getChildren = () => {
      nodeID = -1;
      return results.map(walkNode.bind(this));
    }
  }

  handleUpdateProps(nodeID) {
    return (props) => {
      if (this.bindings[nodeID]) {
        const newState = {};
        Object.keys(props).forEach((propName) => {
          const val = props[propName];
          if (this.bindings[nodeID][propName]) {
            newState[this.bindings[nodeID][propName]] = val;
          }
        });
        this.setState(newState);
      }
    };
  }

  render() {
    return (<div className="article">{this.getChildren()}</div>);
  }
}

var mountNode = document.createElement('div');
document.body.appendChild(mountNode);


ReactDOM.render(<InteractiveDocument />, mountNode);
