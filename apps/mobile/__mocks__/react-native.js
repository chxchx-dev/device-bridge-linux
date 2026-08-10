const React = require('react');

const element = (name) => (props) => React.createElement(name, props, props.children);

module.exports = {
  StatusBar: element('StatusBar'),
  Pressable: element('Pressable'),
  Text: element('Text'),
  TextInput: element('TextInput'),
  View: element('View'),
  StyleSheet: { create: (styles) => styles },
};
