import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const App = () => {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file.");
      return;
    }

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetsData = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0, raw: false });
          const dataRows = jsonData.slice(1, 4); // Get the first three data rows
          return {
            name: sheetName,
            columns: jsonData[0].map(column => ({ name: column, type: 'INT', foreignKey: '', refTable: '', refColumn: '' })),
            dataRows,
            sqlSchema: '',
            insertStatements: ''
          };
        });
        setSheets(sheetsData);
      };

      fileReader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error handling file:", error);
      alert("Error handling file. Please try again.");
    }
  };

  const handleChangeType = (sheetIndex, colIndex, field, value) => {
    const newSheets = [...sheets];
    newSheets[sheetIndex].columns[colIndex][field] = value;
    setSheets(newSheets);
  };

  const generateSQLSchema = (sheetIndex) => {
    const sheet = sheets[sheetIndex];
    const schemaParts = sheet.columns.map(col => `\`${col.name}\` ${col.type}${col.foreignKey ? ` FOREIGN KEY REFERENCES ${col.refTable}(${col.refColumn})` : ''}`);
    const schema = `CREATE TABLE \`${sheet.name}\` (${schemaParts.join(', ')});`;
    const newSheets = [...sheets];
    newSheets[sheetIndex].sqlSchema = schema;

    // Generate INSERT statements
    const insertStatements = generateInsertStatements(sheet);
    newSheets[sheetIndex].insertStatements = insertStatements;

    setSheets(newSheets);
  };

  const generateInsertStatements = (sheet) => {
    const columnNames = sheet.columns.map(col => `\`${col.name}\``).join(', ');
    const values = sheet.dataRows.map(row =>
      '(' + row.map(value =>
        typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value // Escape single quotes in SQL
      ).join(', ') + ')'
    ).join(',\n    ');

    return `-- Inserting data into ${sheet.name} table\n` +
      `INSERT INTO \`${sheet.name}\` (${columnNames}) VALUES\n    ${values};`;
  };

  return (
    <div>
      <h2>Upload and Process Excel File</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload and Load Sheets</button>

      {sheets.map((sheet, sheetIndex) => (
        <div key={sheetIndex}>
          <h3>Sheet: {sheet.name}</h3>
          {sheet.columns.length > 0 ? (
            <>
              <h4>Set Data Types and Foreign Keys for Columns</h4>
              {sheet.columns.map((col, colIndex) => (
                <div key={colIndex}>
                  {col.name}:
                  <input
                    type="text"
                    placeholder="Data Type"
                    value={col.type}
                    onChange={(e) => handleChangeType(sheetIndex, colIndex, 'type', e.target.value)}
                  />
                  <input
                    type="checkbox"
                    checked={col.foreignKey}
                    onChange={(e) => handleChangeType(sheetIndex, colIndex, 'foreignKey', e.target.checked ? 'FOREIGN KEY' : '')}
                  /> Is Foreign Key?
                  {col.foreignKey && (
                    <>
                      <input
                        type="text"
                        placeholder="Reference Table"
                        value={col.refTable}
                        onChange={(e) => handleChangeType(sheetIndex, colIndex, 'refTable', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Reference Column"
                        value={col.refColumn}
                        onChange={(e) => handleChangeType(sheetIndex, colIndex, 'refColumn', e.target.value)}
                      />
                    </>
                  )}
                </div>
              ))}
              <button onClick={() => generateSQLSchema(sheetIndex)}>Generate SQL Schema & Insert Statements</button>
              {sheet.sqlSchema && (
                <>
                  <h4>SQL Schema</h4>
                  <pre>{sheet.sqlSchema}</pre>
                </>
              )}
              {sheet.insertStatements && (
                <>
                  <h4>Insert Statements</h4>
                  <pre>{sheet.insertStatements}</pre>
                </>
              )}
            </>
          ) : (
            <p>No data found in this sheet.</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default App;
