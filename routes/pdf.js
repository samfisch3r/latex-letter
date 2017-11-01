const express = require('express')
const shortid = require('shortid')
const router = express.Router()
const fs = require('fs')
const
  spawn = require('child_process')
  .spawnSync

const cleanup = (inputFile, outputFile) => {
  spawn(`rm`, [inputFile])
  spawn(`rm`, [outputFile])
}

const makePDF = (inputFile, outputFile) => {
  const pandoc = spawn(`pandoc`, [`${inputFile}`,
      `-o`,
      `${outputFile}`,
       `--template=letter/template.tex`,
        `--latex-engine=xelatex`,
        `--latex-engine-opt=--disable-write18`
        // this disables remote execution of random code in LaTeX (hopefully)
      ])
  const error = pandoc.stderr.toString()
  if (error) {
    console.log(error)
  }
}

const validateInput = (body) => {
  // "To" fields are required for the LaTeX compiler
  if (!body.to1) return false
  if (!body.to2) return false
  if (!body.to3) return false
  return true
}

// Removes \ from user input string
// Sanitize other characters
const sanitize = (input) => {
  return input
    .replace(String.fromCharCode(92), ``)
    .replace(`#`, `\\#`)
    .replace(`%`, `\\%`)
    .replace(`$`, `\\$`)
    .replace(`^`, `\\^`)
    .replace(`&`, `\\&`)
    .replace(`{`, `\\{`)
    .replace(`}`, `\\}`)
}

// Don't allow user to execute code on server using LaTeX
// E.g. \input{/etc/passwd}
// Or even worse: \write18{rm -rf /}
const sanitizeInput = (body) => {
  console.log(body)
  for (let prop in body) {
    body[prop] = sanitize(body[prop])
  }
  console.log(body)
  return body
}

router.post('/', (req, res) => {
  // Make sure user-letters folder exists
  spawn(`mkdir`, [`-p`, `user-letters`])

  const uniqueId = shortid.generate()
  const inputFile = `user-letters/letter-${uniqueId}.md`
  const outputFile = `user-letters/output-${uniqueId}.pdf`

    // Validate user input
  if (!validateInput(req.body)) {
    return res.send(`Incorrect data. "To" form fields cannot be empty.`)
  }

    // Sanitize user input
  const letterContent = formBodyToMarkDown(sanitizeInput(req.body))

  fs.writeFile(inputFile, letterContent, () => {
    makePDF(inputFile, outputFile)
    const readStream = fs.createReadStream(outputFile)
      // Getting file stats
    const stats = fs.statSync(outputFile)
      // Setting file size
    res.setHeader('Content-Length', stats.size)
    res.setHeader('Content-Type', 'application/pdf')
      // Setting file name and type
    res.setHeader('Content-Disposition', 'attachment; filename="letter.pdf"')
    readStream.pipe(res)
      // Cleanup files
    cleanup(inputFile, outputFile)
  })
})

const formBodyToMarkDown = ({
  content,
  subject,
  author,
  city,
  from1,
  from2,
  to1,
  to2,
  to3
}) => (`---
subject: ${subject}
author: ${author}
city: ${city}
from:
- ${from1}
- ${from2}
to:
- ${to1}
- ${to2}
- ${to3}

# Settings
mainfont: Hoefler Text
altfont: Helvetica Neue
monofont: Courier
lang: german
fontsize: 10pt
geometry: a4paper, left=35mm, right=35mm, top=50mm, bottom=25mm
# letterhead: true
# customdate: YYYY-MM-DD
---
${content || standardText}
`)

const standardText = ``

module.exports = router
