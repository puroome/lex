/**
 * @OnlyCurrentDoc
 */

// API 키를 여기에 입력하세요.
const MERRIAM_WEBSTER_API_KEY = "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3";

// ================================================================
// 전역 설정
// ================================================================
const CACHE_KEYS = {
  WORDS: 'wordListCache'
};


// ================================================================
// 웹 앱 요청 처리 (doGet)
// ================================================================
function doGet(e) {
  if (e.parameter.action) {
    let response;
    try {
      const action = e.parameter.action;
      switch (action) {
        case 'getWords':
          const forceRefresh = e.parameter.forceRefresh === 'true';
          response = getWords(forceRefresh);
          break;
        case 'getQuizBatch':
          const quizType = e.parameter.quizType;
          const batchSize = parseInt(e.parameter.batchSize, 10) || 10;
          const excludeWordsStr = e.parameter.excludeWords || '';
          if (!quizType) throw new Error("quizType 파라미터가 누락되었습니다.");
          response = getQuizBatch(quizType, batchSize, excludeWordsStr);
          break;
        case 'updateSRSData':
          const wordToUpdate = e.parameter.word;
          const isCorrect = e.parameter.isCorrect;
          const quizTypeParam = e.parameter.quizType;
          if (!wordToUpdate || isCorrect === undefined || !quizTypeParam) throw new Error("필수 파라미터(word, isCorrect, quizType)가 누락되었습니다.");
          response = updateSRSData(wordToUpdate, isCorrect, quizTypeParam);
          break;
        case 'translateText':
          const textToTranslate = e.parameter.text;
          if (!textToTranslate) throw new Error("Text parameter is missing.");
          response = translateText(textToTranslate);
          break;
        case 'getLastLearnedIndex': // 학습 위치 동기화 (읽기)
          response = getLastLearnedIndex();
          break;
        case 'setLastLearnedIndex': // 학습 위치 동기화 (쓰기)
          const indexToSet = e.parameter.index;
          if (indexToSet === undefined) throw new Error("index 파라미터가 누락되었습니다.");
          response = setLastLearnedIndex(parseInt(indexToSet, 10));
          break;
        default:
          throw new Error(`Invalid action: ${action}`);
      }
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      Logger.log(error.stack);
      const errorResponse = { error: true, message: `Script error: ${error.message}` };
      return ContentService.createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return HtmlService.createHtmlOutput("<p>Please use the GitHub Pages URL.</p>");
}

// ================================================================
// 실시간 퀴즈 생성 로직 (수정됨)
// ================================================================
function getQuizBatch(quizType, batchSize, excludeWordsStr) {
  try {
    const allWordsData = getWords(false).words;
    const excludeWords = excludeWordsStr ? excludeWordsStr.split(',') : [];

    if (allWordsData.length < 5) {
      return { quizzes: [], allWordsLearned: false };
    }

    let reviewCandidates;
    if (quizType === 'MULTIPLE_CHOICE_MEANING') {
      reviewCandidates = allWordsData.filter(word => word.srsMeaning !== 1 && !excludeWords.includes(word.word));
    } else if (quizType === 'FILL_IN_THE_BLANK') {
      reviewCandidates = allWordsData.filter(word => word.srsBlank !== 1 && word.sample && word.sample.trim() !== '' && !excludeWords.includes(word.word));
    } else if (quizType === 'MULTIPLE_CHOICE_DEFINITION') {
      reviewCandidates = allWordsData.filter(word => word.srsDefinition !== 1 && !excludeWords.includes(word.word));
    } else {
      throw new Error(`Invalid quizType: ${quizType}`);
    }

    reviewCandidates.sort(() => 0.5 - Math.random());
    const quizBatch = [];
    const allWordsLearned = reviewCandidates.length === 0;
    
    // 타임아웃을 방지하기 위해 처리할 후보 단어 수를 제한합니다.
    const candidatesToProcess = reviewCandidates.slice(0, batchSize * 5); // 충분한 후보군 확보

    if (quizType === 'MULTIPLE_CHOICE_DEFINITION') {
        const cache = CacheService.getScriptCache();
        const wordsToFetch = [];

        // 제한된 후보군 내에서만 순회합니다.
        for (const wordData of candidatesToProcess) {
            if (quizBatch.length >= batchSize) break;
            const cacheKey = `mw_learner_def_${wordData.word.toLowerCase()}`;
            const cachedDef = cache.get(cacheKey);
            if (cachedDef && cachedDef !== '__NOT_FOUND__') {
                const quiz = createDefinitionQuiz(wordData, allWordsData, cachedDef);
                if (quiz) quizBatch.push(quiz);
            } else if (!cachedDef) {
                wordsToFetch.push(wordData);
            }
        }

        const NEW_FETCH_LIMIT = 3; 
        let fetchedCount = 0;
        if (quizBatch.length < batchSize) {
            for (const wordData of wordsToFetch) {
                if (quizBatch.length >= batchSize || fetchedCount >= NEW_FETCH_LIMIT) break;
                const definition = fetchDefinitionFromAPI(wordData.word);
                if (definition) {
                    const quiz = createDefinitionQuiz(wordData, allWordsData, definition);
                    if (quiz) quizBatch.push(quiz);
                }
                fetchedCount++;
            }
        }
    } else {
        // 다른 퀴즈 유형들은 제한된 후보군 내에서 처리합니다.
        for (const wordData of candidatesToProcess) {
            if (quizBatch.length >= batchSize) break;
            let quiz;
            if (quizType === 'MULTIPLE_CHOICE_MEANING') {
                quiz = createMeaningQuiz(wordData, allWordsData);
            } else if (quizType === 'FILL_IN_THE_BLANK') {
                quiz = createFillInTheBlankQuiz(wordData, allWordsData);
            }
            if (quiz) {
                quizBatch.push(quiz);
            }
        }
    }

    return { quizzes: quizBatch, allWordsLearned };

  } catch (e) {
    Logger.log(`getQuizBatch Error: ${e.message}\n${e.stack}`);
    return { error: true, message: e.message };
  }
}


// ================================================================
// 헤더 관리 헬퍼 함수
// ================================================================
function getHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = {};
  headers.forEach((header, index) => {
    if (header && typeof header === 'string' && header.trim() !== '') {
      headerMap[header.trim().toLowerCase()] = index;
    }
  });
  return headerMap;
}

// ================================================================
// 데이터 가져오기 (시트, 단어)
// ================================================================
function getSheet(sheetName = 'Words') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet '${sheetName}' not found.`);
  return sheet;
}

function getWords(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = CACHE_KEYS.WORDS;
  
  if (forceRefresh) {
    cache.remove(CACHE_KEY);
  } else {
    const cachedWords = cache.get(CACHE_KEY);
    if (cachedWords) {
      return JSON.parse(cachedWords);
    }
  }

  try {
    const sheet = getSheet('Words');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const headerMap = {};
    headers.forEach((h, i) => { if(h) headerMap[h.trim().toLowerCase()] = i; });
    
    const { 
        word: wordCol, pos: posCol, pronunciation: pronCol, meaning: meaningCol, 
        sample: sampleCol, explanation: explanationCol, aisample: aiSampleCol, 
        srsmeaning: srsMeaningCol, srsblank: srsBlankCol, srsdefinition: srsDefinitionCol,
        incorrect: incorrectCol, lastincorrect: lastIncorrectCol
    } = headerMap;

    if ([wordCol, posCol, meaningCol].some(c => c === undefined)) {
      throw new Error("필수 헤더(Word, POS, Meaning)를 찾을 수 없습니다.");
    }
    
    const words = data
      .map(row => {
        const manualSample = String(row[sampleCol] || "");
        const aiSample = (aiSampleCol !== undefined ? String(row[aiSampleCol]) : "") || "";
        let sampleText = "";
        let sampleSource = "none";

        if (manualSample) {
            sampleText = manualSample;
            sampleSource = "manual";
        } else if (aiSample) {
            sampleText = aiSample;
            sampleSource = "ai";
        }
        
        const srsMeaningVal = srsMeaningCol !== undefined ? row[srsMeaningCol] : null;
        const srsBlankVal = srsBlankCol !== undefined ? row[srsBlankCol] : null;
        const srsDefinitionVal = srsDefinitionCol !== undefined ? row[srsDefinitionCol] : null;
        
        const srsMeaning = (srsMeaningVal === '' || srsMeaningVal === null) ? null : Number(srsMeaningVal);
        const srsBlank = (srsBlankVal === '' || srsBlankVal === null) ? null : Number(srsBlankVal);
        const srsDefinition = (srsDefinitionVal === '' || srsDefinitionVal === null) ? null : Number(srsDefinitionVal);
        
        return {
          word: String(row[wordCol] || ""),
          pos: String(row[posCol] || ""),
          pronunciation: String(row[pronCol] || ""),
          meaning: String(row[meaningCol] || ""),
          sample: sampleText,
          sampleSource: sampleSource, 
          explanation: String(row[explanationCol] || ""),
          srsMeaning: srsMeaning,
          srsBlank: srsBlank,
          srsDefinition: srsDefinition,
          incorrect: (incorrectCol !== undefined ? Number(row[incorrectCol]) : 0) || 0,
          lastIncorrect: (lastIncorrectCol !== undefined ? row[lastIncorrectCol] : null) || null
        }
      })
      .filter(wordObj => wordObj.word && wordObj.word.trim() !== "");
    
    const response = { words };
    
    try {
      cache.put(CACHE_KEY, JSON.stringify(response), 3600); 
    } catch (e) {
      Logger.log("캐시 저장 실패 (용량 초과 가능성 높음): " + e.message);
    }

    return response;
  } catch (e) {
    Logger.log("getWords 함수 오류: " + e.message + "\n" + e.stack);
    return { error: true, message: e.message };
  }
}

// ================================================================
// 퀴즈 생성 로직
// ================================================================
function createMeaningQuiz(correctWordData, allWordsData) {
  const correctWordPos = correctWordData.pos;
  const wrongAnswers = [];
  
  let candidates = allWordsData.filter(word => word.pos === correctWordPos && word.meaning !== correctWordData.meaning);
  
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  wrongAnswers.push(...candidates.slice(0, 3).map(w => w.meaning));

  if (wrongAnswers.length < 3) {
    const otherWords = allWordsData.filter(word => word.meaning !== correctWordData.meaning && !wrongAnswers.includes(word.meaning));
    for (let i = otherWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherWords[i], otherWords[j]] = [otherWords[j], otherWords[i]];
    }
    wrongAnswers.push(...otherWords.slice(0, 3 - wrongAnswers.length).map(w => w.meaning));
  }
  
  if (wrongAnswers.length < 3) return null;

  const choices = [correctWordData.meaning, ...wrongAnswers].sort(() => 0.5 - Math.random());

  return {
    type: 'MULTIPLE_CHOICE_MEANING',
    question: { word: correctWordData.word },
    choices: choices,
    answer: correctWordData.meaning
  };
}

function createFillInTheBlankQuiz(correctWordData, allWordsData) {
  if (!correctWordData.sample || correctWordData.sample.trim() === '') return null;
  
  const firstLineSentence = correctWordData.sample.split('\n')[0]
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
    .trim();

  let sentenceWithBlank = "";
  const placeholderRegex = /\*(.*?)\*/;
  const match = firstLineSentence.match(placeholderRegex);
  if (match) {
    sentenceWithBlank = firstLineSentence.replace(placeholderRegex, "＿＿＿＿").trim();
  } else {
    const wordRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i');
    if (firstLineSentence.match(wordRegex)) {
       sentenceWithBlank = firstLineSentence.replace(wordRegex, "＿＿＿＿").trim();
    } else {
       return null; 
    }
  }
  
  const wrongAnswers = [];
  
  let candidates = allWordsData.filter(word => word.pos === correctWordData.pos && word.word !== correctWordData.word);
  
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  
  wrongAnswers.push(...candidates.slice(0, 3).map(w => w.word));

  if (wrongAnswers.length < 3) {
    const otherWords = allWordsData.filter(word => 
        word.word !== correctWordData.word && 
        !wrongAnswers.includes(word.word)
    );
    for (let i = otherWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherWords[i], otherWords[j]] = [otherWords[j], otherWords[i]];
    }
    wrongAnswers.push(...otherWords.slice(0, 3 - wrongAnswers.length).map(w => w.word));
  }

  if (wrongAnswers.length < 3) return null; 

  const choices = [correctWordData.word, ...wrongAnswers].sort(() => 0.5 - Math.random());

  return {
    type: 'FILL_IN_THE_BLANK',
    question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word },
    choices: choices,
    answer: correctWordData.word
  };
}

function createDefinitionQuiz(correctWordData, allWordsData, definition) {
    if (!definition) return null;

    const wrongAnswers = [];
  
    let candidates = allWordsData.filter(word => word.pos === correctWordData.pos && word.word !== correctWordData.word);
    
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    
    wrongAnswers.push(...candidates.slice(0, 3).map(w => w.word));

    if (wrongAnswers.length < 3) {
      const otherWords = allWordsData.filter(word => 
          word.word !== correctWordData.word && 
          !wrongAnswers.includes(word.word)
      );
      for (let i = otherWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherWords[i], otherWords[j]] = [otherWords[j], otherWords[i]];
      }
      wrongAnswers.push(...otherWords.slice(0, 3 - wrongAnswers.length).map(w => w.word));
    }
    
    if (wrongAnswers.length < 3) return null;

    const choices = [correctWordData.word, ...wrongAnswers].sort(() => 0.5 - Math.random());

    return {
        type: 'MULTIPLE_CHOICE_DEFINITION',
        question: {
            definition: definition,
            word: correctWordData.word
        },
        choices: choices,
        answer: correctWordData.word
    };
}


// ================================================================
// 데이터 수정 및 유틸리티
// ================================================================
function updateSRSData(word, isCorrectStr, quizType) {
  try {
    const sheet = getSheet('Words');
    const headerMap = getHeaderMap(sheet);

    const wordCol_1based = headerMap['word'] !== undefined ? headerMap['word'] + 1 : null;
    const srsMeaningCol_1based = headerMap['srsmeaning'] !== undefined ? headerMap['srsmeaning'] + 1 : null;
    const srsBlankCol_1based = headerMap['srsblank'] !== undefined ? headerMap['srsblank'] + 1 : null;
    const srsDefinitionCol_1based = headerMap['srsdefinition'] !== undefined ? headerMap['srsdefinition'] + 1 : null;
    const incorrectCol_1based = headerMap['incorrect'] !== undefined ? headerMap['incorrect'] + 1 : null;
    const lastIncorrectCol_1based = headerMap['lastincorrect'] !== undefined ? headerMap['lastincorrect'] + 1 : null;

    if (!wordCol_1based) throw new Error("시트에서 'Word' 헤더를 찾을 수 없습니다.");
    if (srsMeaningCol_1based === null) throw new Error("시트에서 'srsmeaning' 헤더를 찾을 수 없습니다.");
    if (srsBlankCol_1based === null) throw new Error("시트에서 'srsblank' 헤더를 찾을 수 없습니다.");
    if (srsDefinitionCol_1based === null) throw new Error("시트에서 'srsdefinition' 헤더를 찾을 수 없습니다.");
    if (!incorrectCol_1based) throw new Error("시트에서 'Incorrect' 헤더를 찾을 수 없습니다.");
    if (!lastIncorrectCol_1based) throw new Error("시트에서 'LastIncorrect' 헤더를 찾을 수 없습니다.");

    const wordColumnValues = sheet.getRange(2, wordCol_1based, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex_0based = wordColumnValues.indexOf(word);

    if (rowIndex_0based === -1) {
      throw new Error(`'${word}' 단어를 시트에서 찾을 수 없습니다.`);
    }

    const targetRow_1based = rowIndex_0based + 2;
    const isCorrect = isCorrectStr === 'true';
    const valueToWrite = isCorrect ? 1 : 0;

    let targetSrsCol;
    if (quizType === 'MULTIPLE_CHOICE_MEANING') {
      targetSrsCol = srsMeaningCol_1based;
    } else if (quizType === 'FILL_IN_THE_BLANK') {
      targetSrsCol = srsBlankCol_1based;
    } else if (quizType === 'MULTIPLE_CHOICE_DEFINITION') {
      targetSrsCol = srsDefinitionCol_1based;
    } else {
      throw new Error(`잘못된 quizType 입니다: ${quizType}`);
    }

    sheet.getRange(targetRow_1based, targetSrsCol).setValue(valueToWrite);

    if (!isCorrect) {
      sheet.getRange(targetRow_1based, incorrectCol_1based).setValue(1);
      sheet.getRange(targetRow_1based, lastIncorrectCol_1based).setValue(new Date());
    }

    CacheService.getScriptCache().remove(CACHE_KEYS.WORDS);

    const srsMeaning = sheet.getRange(targetRow_1based, srsMeaningCol_1based).getValue();
    const srsBlank = sheet.getRange(targetRow_1based, srsBlankCol_1based).getValue();
    const srsDefinition = sheet.getRange(targetRow_1based, srsDefinitionCol_1based).getValue();

    return {
      success: true,
      updatedWord: { srsMeaning, srsBlank, srsDefinition }
    };
  } catch(e) {
    Logger.log("updateSRSData Error: " + e.stack);
    return { success: false, message: e.message };
  }
}

function translateText(text) {
  try {
    const translatedText = LanguageApp.translate(text, 'en', 'ko');
    return { success: true, translatedText };
  } catch (error) {
    return { success: false, message: `Translation failed: ${error.message}` };
  }
}

function fetchDefinitionFromAPI(word) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `mw_learner_def_${word.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached === '__NOT_FOUND__' ? null : cached;
  }
  
  try {
    const url = `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${MERRIAM_WEBSTER_API_KEY}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0].shortdef && data[0].shortdef.length > 0) {
        const definitions = data[0].shortdef.slice(0, 2);
        const combinedDefinition = definitions.join('; ');
        cache.put(cacheKey, combinedDefinition, 21600);
        return combinedDefinition;
      }
    }
    
    cache.put(cacheKey, '__NOT_FOUND__', 3600);
    return null;
  } catch (e) {
    Logger.log(`Merriam-Webster API fetch failed for "${word}": ${e.message}`);
    return null;
  }
}

// ================================================================
// UserData 시트 관리 (학습 위치 동기화)
// ================================================================
function getLastLearnedIndex() {
  try {
    const sheet = getSheet('UserData');
    const index = sheet.getRange("B1").getValue();
    return { success: true, index: parseInt(index, 10) || 0 };
  } catch (e) {
    Logger.log(`getLastLearnedIndex Error: ${e.message}\n${e.stack}`);
    return { success: false, message: e.message, index: 0 };
  }
}

function setLastLearnedIndex(index) {
  try {
    const sheet = getSheet('UserData');
    sheet.getRange("B1").setValue(index);
    return { success: true, index: index };
  } catch (e) {
    Logger.log(`setLastLearnedIndex Error: ${e.message}\n${e.stack}`);
    return { success: false, message: e.message };
  }
}

