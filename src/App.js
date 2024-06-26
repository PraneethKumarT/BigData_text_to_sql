import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import './App.css';
import downArrow from './downarrow.PNG';
import nyulogo from './nyu_short_color.png'



const App = () => {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);

  const [question, setQuestion] = useState('');  // State to store the user's question
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New loading state



  const getSQL = () => {
    let script = '';
    console.log("started request")
    setIsLoading(true); // Start loading

    sheets?.forEach((sheet) => {
      script += sheet.sqlSchema;
      script += ';\n\n';
    });

    sheets?.forEach((sheet) => {
      script += sheet.insertStatements;
      script += ';\n\n';
    });

    // Now make the HTTP request with the generated SQL script in the body
    axios.post('https://us-central1-llmsql.cloudfunctions.net/helloWorld', {
      schema: script,
      user_in_put: question
    })
      .then(response => {
        setAnswer(response.data)
        console.log('Success:', response.data);
      })
      .catch(error => {
        console.error('Error:', error);
      })
      .finally(() => setIsLoading(false)); // End loading regardless of the result

  }


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

  console.log()

  return (
    <div>

      <header>
        <img src={nyulogo} alt="Down Arrow" height="60" />
        <h1>Text to SQL using LLM</h1>


      </header>

      <h2>Upload and Process Excel File</h2>



      <div className="file-upload">
        <div>
          <input type="file" id="file" accept=".xlsx, .xls" onChange={handleFileChange} style={{ display: 'none' }} />
          <label htmlFor="file" className="file-upload-btn">Choose File</label>
        </div>
        <div>

          <button onClick={handleUpload}>Upload and Load Sheets</button>
        </div>

      </div>



      <h4>Question: {question}</h4>

      <div>
        <label htmlFor="question">Enter your SQL question:</label>
        <input
          id="question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question here..."
        />
      </div>

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

      <button onClick={() => getSQL()}>Get SQL</button>
      <br />
      <br />

      <div className="answer-box">
        {isLoading ? <div className="loader"></div> : <p>{answer?.sqlGeneration?.message}</p>}
      </div>

      <div className="flowchart-container">
        <div className="flowchart-item">
          <div className="flowchart-title">1. Information Determination</div>
          <div className="flowchart-title">

            {answer && answer.informationDetermination_output && answer?.informationDetermination_output.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index !== answer.informationDetermination_output.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>

        </div>

        <div className="flowchart-arrow">
          <img src={downArrow} alt="Down Arrow" height="60" />

        </div>


        <div className="flowchart-item">
          <div className="flowchart-title">2. Classification & Hint</div>
          <div className="flowchart-title">{answer.classificationAndHint_output}</div>

        </div>

        <div className="flowchart-arrow">
          <img src={downArrow} alt="Down Arrow" height="60" />

        </div>

        <div className="flowchart-item">
          <div className="flowchart-title">3. SQL Generation</div>

          <div className="flowchart-title">

            {answer && answer?.sqlGeneration_output?.prompt && answer?.sqlGeneration_output?.prompt.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index !== answer?.sqlGeneration_output?.prompt.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>

          <div className="flowchart-title">{answer?.sqlGeneration_output?.sql}</div>

        </div>

      </div>

    </div>
  );
};

export default App;
