/**
 * @OnlyCurrentDoc
 */

// ================================================================
// 전역 변수 (Global Variables)
// ================================================================
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

function getApiKey() {
  // 스크립트 속성에서 API 키를 가져옵니다.
  // 이 키는 Code.gs 파일 상단 메뉴의 '프로젝트 설정' > '스크립트 속성' 탭에서 설정해야 합니다.
  const apiKey = SCRIPT_PROPERTIES.getProperty('TTS_API_KEY');
  if (!apiKey) {
    throw new Error("TTS_API_KEY is not set in Script Properties.");
  }
  return apiKey;
}

// ================================================================
// 웹 앱 요청 처리 (doGet)
// ================================================================
function doGet(e) {
  // 요청마다 Lock을 사용하여 동시성 문제를 방지합니다.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // 최대 15초 대기

  try {
    if (e.parameter.action) {
      let response;
      const action = e.parameter.action;
      Logger.log(`Action received: ${action} with params: ${JSON.stringify(e.parameter)}`);

      switch (action) {
        case 'getWords':
          response = getWords(e.parameter.forceRefresh === 'true');
          break;
        case 'getQuiz':
          response = getQuizBatch();
          break;
        case 'updateStatus':
          if (!e.parameter.word) throw new Error("Word parameter is missing.");
          response = updateLearnedStatus(e.parameter.word);
          break;
        case 'translateText':
          if (!e.parameter.text) throw new Error("Text parameter is missing.");
          response = translateText(e.parameter.text);
          break;
        case 'getTTS':
          if (!e.parameter.text || !e.parameter.voiceSet || !e.parameter.contentType) {
            throw new Error("Missing parameters for getTTS action.");
          }
          response = getTTS(e.parameter.text, e.parameter.voiceSet, e.parameter.contentType);
          break;
        default:
          throw new Error(`Invalid action: ${action}`);
      }
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // 기본 액션이 없는 경우 에러 대신 HTML 반환
    return HtmlService.createHtmlOutput("<p>Invalid request. Please specify an action.</p>");
  } catch (error) {
    Logger.log(`Error in doGet: ${error.stack}`);
    const errorResponse = { error: true, message: `Script error: ${error.message}` };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ================================================================
// TTS 음성 생성 및 캐싱
// ================================================================
function getTTS(text, voiceSet, contentType) {
  const FOLDER_NAME = "TTS_Cache_VocabApp";
  
  try {
    Logger.log(`getTTS started for text: "${text}", voiceSet: ${voiceSet}, contentType: ${contentType}`);

    // 1. 캐시 폴더 가져오기 또는 생성
    let folders = DriveApp.getFoldersByName(FOLDER_NAME);
    let cacheFolder;
    if (folders.hasNext()) {
      cacheFolder = folders.next();
      Logger.log(`Cache folder "${FOLDER_NAME}" found.`);
    } else {
      cacheFolder = DriveApp.createFolder(FOLDER_NAME);
      Logger.log(`Cache folder "${FOLDER_NAME}" created.`);
    }

    // 2. 파일 이름 생성 및 캐시 확인
    const textWithoutEmoji = text.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, '');
    const processedText = textWithoutEmoji.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
    const fileName = `${processedText}_${voiceSet}_${contentType}.mp3`;
    
    const files = cacheFolder.getFilesByName(fileName);
    if (files.hasNext()) {
      const cachedFile = files.next();
      Logger.log(`Cache hit for "${fileName}". Returning cached file.`);
      const audioContent = Utilities.base64Encode(cachedFile.getBlob().getBytes());
      return { audioContent: audioContent };
    }

    Logger.log(`Cache miss for "${fileName}". Calling TTS API.`);

    // 3. TTS API 호출
    const voiceSets = {
      'UK': { 'word': { languageCode: 'en-GB', name: 'en-GB-Wavenet-D', ssmlGender: 'MALE' }, 'sample': { languageCode: 'en-GB', name: 'en-GB-Journey-D', ssmlGender: 'MALE' } },
      'US': { 'word': { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' }, 'sample': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' } }
    };
    const voiceConfig = voiceSets[voiceSet][contentType];
    if (!voiceConfig) {
      throw new Error(`Invalid voice configuration for voiceSet: ${voiceSet}, contentType: ${contentType}`);
    }

    const TTS_API_KEY = getApiKey();
    const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;
    
    const payload = {
      input: { text: processedText },
      voice: voiceConfig,
      audioConfig: { audioEncoding: 'MP3' }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // 에러 발생 시 예외를 던지지 않고 응답을 받기 위함
    };

    Logger.log(`Sending request to TTS API. URL: ${TTS_URL}, Payload: ${JSON.stringify(payload)}`);
    const response = UrlFetchApp.fetch(TTS_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log(`TTS API response code: ${responseCode}`);

    if (responseCode !== 200) {
      Logger.log(`TTS API Error Response Body: ${responseBody}`);
      const errorData = JSON.parse(responseBody);
      throw new Error(`TTS API Error: ${errorData.error.message || 'Unknown error'}`);
    }

    const data = JSON.parse(responseBody);
    if (!data.audioContent) {
      throw new Error("TTS API returned no audio content.");
    }
    
    // 4. 캐시 파일 저장 및 반환
    const audioBytes = Utilities.base64Decode(data.audioContent);
    const audioBlob = Utilities.newBlob(audioBytes, 'audio/mpeg', fileName);
    cacheFolder.createFile(audioBlob);
    Logger.log(`Successfully created cache file: "${fileName}"`);
    
    return { audioContent: data.audioContent };

  } catch (e) {
    Logger.log(`!!! CRITICAL ERROR in getTTS: ${e.stack}`);
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
      headerMap[header.trim()] = index;
    }
  });
  return headerMap;
}

// ================================================================
// 데이터 가져오기 (시트, 단어, 퀴즈)
// ================================================================
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Words');
  if (!sheet) throw new Error("Sheet 'Words' not found.");
  return sheet;
}

function getWords(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  if (forceRefresh) {
    cache.remove('wordListCache');
    Logger.log("Forced refresh: wordListCache cleared.");
  } else {
    const cachedWords = cache.get('wordListCache');
    if (cachedWords) {
      Logger.log("Returning words from cache.");
      return JSON.parse(cachedWords);
    }
  }

  try {
    Logger.log("Fetching words from Google Sheet.");
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const headerMap = {};
    headers.forEach((h, i) => { if(h) headerMap[h.trim()] = i; });
    const { Word: wordCol, POS: posCol, Pronunciation: pronCol, Meaning: meaningCol, Sample: sampleCol, Explanation: explanationCol, AISample: aiSampleCol, Status: statusCol } = headerMap;

    if ([wordCol, posCol, meaningCol].some(c => c === undefined)) {
      throw new Error("Required headers (Word, POS, Meaning) not found.");
    }
    
    const words = data
      .map(row => {
        const manualSample = row[sampleCol] || "";
        const aiSample = (aiSampleCol !== undefined ? row[aiSampleCol] : "") || "";
        
        let sampleText = "";
        let sampleSource = "none";

        if (manualSample) {
            sampleText = manualSample;
            sampleSource = "manual";
        } else if (aiSample) {
            sampleText = aiSample;
            sampleSource = "ai";
        }

        return {
          word: row[wordCol] || "",
          pos: row[posCol] || "",
          pronunciation: row[pronCol] || "",
          meaning: row[meaningCol] || "",
          sample: sampleText,
          sampleSource: sampleSource, 
          explanation: row[explanationCol] || "",
          status: (statusCol !== undefined ? row[statusCol] : "") || ""
        }
      })
      .filter(wordObj => wordObj.word && wordObj.word.trim() !== "");
    
    const response = { words };
    
    try {
      cache.put('wordListCache', JSON.stringify(response), 3600); 
      Logger.log("Successfully cached words.");
    } catch (e) {
      Logger.log(`Failed to cache words (size limit?): ${e.message}`);
    }

    return response;
  } catch (e) {
    Logger.log(`Error in getWords: ${e.stack}`);
    return { error: true, message: e.message };
  }
}

function getQuizBatch() {
  const BATCH_SIZE = 10;
  
  try {
    Logger.log("Generating new quiz batch.");
    const allWordsData = getWords().words; // Use cached words if available

    if (allWordsData.length < 5) {
      return { finished: true, message: 'Not enough words in the sheet to create a quiz.' };
    }

    const unlearnedWords = allWordsData.filter(word => word.status !== 'learned');

    if (unlearnedWords.length === 0) {
      Logger.log("All words learned. Quiz finished.");
      return { finished: true, message: 'Congratulations! You have learned all the words!' };
    }

    for (let i = unlearnedWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unlearnedWords[i], unlearnedWords[j]] = [unlearnedWords[j], unlearnedWords[i]];
    }

    const quizBatch = [];
    const wordsForThisBatch = unlearnedWords.slice(0, BATCH_SIZE);

    for (const correctWordData of wordsForThisBatch) {
      const question = {
        word: correctWordData.word,
        pronunciation: correctWordData.pronunciation,
        sample: correctWordData.sample,
        explanation: correctWordData.explanation
      };

      const wrongAnswers = allWordsData
        .filter(word => word.meaning !== correctWordData.meaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, 4)
        .map(word => word.meaning);
      
      const choices = [correctWordData.meaning, ...wrongAnswers].sort(() => 0.5 - Math.random());

      quizBatch.push({
        question: question,
        choices: choices,
        answer: correctWordData.meaning
      });
    }

    Logger.log(`Generated a quiz batch with ${quizBatch.length} questions.`);
    return { quizzes: quizBatch };
  } catch(e) {
    Logger.log(`Error in getQuizBatch: ${e.stack}`);
    return { error: true, message: e.message };
  }
}

// ================================================================
// 데이터 수정 및 유틸리티
// ================================================================
function updateLearnedStatus(word) {
  try {
    const sheet = getSheet();
    const headerMap = getHeaderMap(sheet);
    const wordCol_1based = (headerMap['Word'] || 0) + 1;
    const statusCol_1based = (headerMap['Status'] || 0) + 1;

    if (!wordCol_1based || !statusCol_1based) {
      throw new Error("Could not find 'Word' or 'Status' headers.");
    }
    
    const data = sheet.getRange(1, wordCol_1based, sheet.getLastRow()).getValues().flat();
    const rowIndex = data.indexOf(word);

    if (rowIndex !== -1) {
        sheet.getRange(rowIndex + 1, statusCol_1based).setValue('learned');
        CacheService.getScriptCache().remove('wordListCache'); // Invalidate cache
        Logger.log(`Updated status for word: "${word}" to learned and cleared cache.`);
        return { success: true };
    }
    throw new Error(`Word '${word}' not found.`);
  } catch(e) {
    Logger.log(`Error in updateLearnedStatus: ${e.stack}`);
    return { success: false, message: e.message };
  }
}

function translateText(text) {
  try {
    const translatedText = LanguageApp.translate(text, 'en', 'ko');
    return { success: true, translatedText };
  } catch (error) {
    Logger.log(`Error in translateText: ${error.stack}`);
    return { success: false, message: `Translation failed: ${error.message}` };
  }
}

