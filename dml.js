const actionHelper = require('./lib/action_helper');

/**
 * Executes a DML operation on a single object
 *
 * @param {node-red-node} node the current node
 * @param {msg} msg the incoming message
 */
const handleInput = (node, msg) => {
  const config = node.config;
  const realAction = (org, payload, nforce) => {
    return new Promise((resolve, reject) => {
      // check for overriding message properties
      // action and object overwrite the configured ones
      const theAction = msg.action ? msg.action : config.action;
      const theObject = msg.object ? msg.object : config.object;
      const sobj = nforce.force.createSObject(theObject, msg.payload);
      Object.assign(payload, {
        sobject: sobj
      });
      // Headers determine some of the behavior - we pass them on
      nforce.extractHeaders(payload, msg);

      let dmlResult;
      switch (theAction) {
        case 'insert':
          dmlResult = org.insert(payload);
          break;
        case 'update':
          dmlResult = org.update(payload);
          break;
        case 'upsert':
          if (msg.hasOwnProperty('externalId')) {
            sobj.setExternalId(msg.externalId.field, msg.externalId.value);
          }
          dmlResult = org.upsert(payload);
          break;
        case 'delete':
          dmlResult = org.delete(payload);
          break;
        default:
          // eslint-disable-next-line no-case-declarations
          const err = new Error('Unknown method:' + theAction);
          reject(err);
      }

      dmlResult
        .then((sfdcResult) => {
          if (typeof sfdcResult == 'string') {
             try {
               parsedSfdcResult = JSON.parse(sfdcResult);
               sfdcResult = parsedSfdcResult;
             } catch (error) {
             }
          }
          
          // Find the best id
          let id = msg.payload.id;
          if (sfdcResult.id) {
            id = sfdcResult.id;
          } else if (msg.externalId) {
            id = msg.externalId;
          }

          let result = {
            success: true,
            object: theObject.toLowerCase(),
            action: theAction,
            id: id
          };
          resolve(result);
        })
        .catch((err) => reject(err));
    });
  };
  actionHelper.inputToSFAction(node, msg, realAction);
};

module.exports = function (RED) {
  function Dml(config) {
    const node = this;
    RED.nodes.createNode(node, config);
    node.connection = RED.nodes.getNode(config.connection);
    node.config = config;
    node.on('input', (msg) => handleInput(node, msg));
  }
  RED.nodes.registerType('dml', Dml);
};
