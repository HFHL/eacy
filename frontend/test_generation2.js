require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'] });
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');
const { CSVConverter } = require('./src/components/FormDesigner/utils/csvConverter.js');
const { SchemaGenerator } = require('./src/components/FormDesigner/core/SchemaGenerator.js');

const csvPath = path.resolve('../字段配置模版-四院.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
Papa.parse(content, {
  header: false,
  complete: function(results) {
    const designModel = CSVConverter.csvToDesignModel(results.data);
    const schema = SchemaGenerator.generateSchema(designModel);
    
    // Check form repeatability in the generated JSON schema
    const properties = schema.properties;
    for (const folderName of Object.keys(properties)) {
       const forms = properties[folderName].properties || {};
       for (const formName of Object.keys(forms)) {
          const formDef = forms[formName];
          const isArray = formDef.type === 'array';
          const target = isArray ? formDef.items : formDef;
          const rowType = target['x-form-template']?.row_type || 'single_row';
          
          if (isArray || rowType === 'multi_row') {
              console.log(`${folderName} > ${formName} : isArray=${isArray}, rowType=${rowType}`);
          }
       }
    }
  }
});
