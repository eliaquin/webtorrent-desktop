const path = require('path')
const names = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' })
const words = {
  en: 'the and you that this with have not are was for what your from',
  es: 'que los las una para por como pero está estoy tengo eres gracias',
  fr: 'les une des est pas dans pour avec vous nous mais sont merci',
  de: 'der die das und ist nicht ein eine ich wir sie mit danke',
  it: 'che gli della sono non per con una questo grazie siamo',
  pt: 'que não uma para com você nós mas está isso obrigado',
  nl: 'het een niet van voor zijn met dat deze maar dank',
  ru: 'это что как мне тебя меня нет есть уже для спасибо'
}
const hints = Object.entries(words).map(([code, list]) => [code, new Set(list.split(' '))])

module.exports = function subtitleLanguage (filePath, subtitle) {
  const filename = path.basename(filePath, path.extname(filePath))
  // Prefer explicit tags such as movie.en.srt and movie.pt-BR.forced.srt.
  for (const part of filename.split(/[._[\]()]+/).reverse()) {
    const tag = part.trim()
    if (!/^[a-z]{2,3}(?:-[a-z]{2}|-[a-z]{4})?$/i.test(tag) || /^(und|mul|zxx|sdh)$/i.test(tag)) continue
    const language = names.of(tag)
    if (language) return language
  }
  const text = subtitle.slice(0, 128 * 1024).replace(/^.*-->.*$/gm, '').replace(/<[^>]*>|\{[^}]*\}/g, '').toLowerCase()
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'Japanese'
  if (/\p{Script=Hangul}/u.test(text)) return 'Korean'
  if (/\p{Script=Greek}/u.test(text)) return 'Greek'
  if (/\p{Script=Hebrew}/u.test(text)) return 'Hebrew'
  const tokens = new Set(text.match(/\p{L}+/gu) || [])
  const scores = hints.map(([code, list]) => [code, [...tokens].filter(word => list.has(word)).length])
    .sort((a, b) => b[1] - a[1])
  if (scores[0][1] >= 3 && scores[0][1] >= scores[1][1] + 2) return names.of(scores[0][0])
  // Ambiguous captions retain their filename instead of an invented language.
  return filename || 'Subtitle'
}
