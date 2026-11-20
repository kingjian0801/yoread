(() => {
    if (globalThis.yoreadTranslationRules) return;

    const clauseWord = /^(?:is|are|was|were|be|will|would|can|could|may|should|must|has|have|had|does|do|did|only|until|if|when|because)$/;

    function splitText(text) {
        const parts = [];
        let offset = 0;
        while (offset < text.length) {
            let end = Math.min(offset + 1800, text.length);
            if (end < text.length) {
                const atSpace = text.lastIndexOf(' ', end);
                if (atSpace > offset + 900) end = atSpace;
                else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
            }
            const source = text.slice(offset, end);
            parts.push({ source, result: source.trim() ? null : source });
            offset = end;
        }
        return parts;
    }

    function* batches(entries) {
        let batch = [];
        let length = 0;
        for (const entry of entries) {
            for (const part of entry.parts) {
                if (part.result !== null) continue;
                if (batch.length === 5 || length + part.source.length > 4000) {
                    yield batch;
                    batch = [];
                    length = 0;
                }
                batch.push({ entry, part });
                length += part.source.length;
            }
        }
        if (batch.length) yield batch;
    }

    function containsUntranslatedProse(source, translation) {
        const original = source.toLowerCase().match(/[a-z]+/g) ?? [];
        const rendered = translation.toLowerCase().match(/[a-z]+/g) ?? [];
        if (original.length >= 5 && rendered.length >= 5 &&
            original.some(word => clauseWord.test(word)) && !/\p{Script=Han}/u.test(translation)) return true;

        const remaining = ` ${rendered.join(' ')} `;
        // Match the entire short fragment or look for longer clauses in larger fragments.
        const clauseLength = Math.max(5, Math.min(7, original.length));
        for (let i = 0; i <= original.length - clauseLength; i++) {
            const phrase = original.slice(i, i + clauseLength);
            if (phrase.some(word => clauseWord.test(word)) && remaining.includes(` ${phrase.join(' ')} `)) return true;
        }
        return false;
    }

    globalThis.yoreadTranslationRules = Object.freeze({ splitText, batches, containsUntranslatedProse });
})();
