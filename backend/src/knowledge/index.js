const baseDocuments = require('./papertradex.json');
const readingList = require('./readingList');

module.exports = {
    documents: [...baseDocuments, ...readingList.documents],
    readingListAnswer: readingList.readingListAnswer,
};
