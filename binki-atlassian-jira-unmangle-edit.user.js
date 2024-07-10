// ==UserScript==
// @name binki-atlassian-jira-unmangle-edit
// @version 1.0.0
// @match https://*.atlassian.net/*
// @homepageURL https://github.com/binki/binki-atlassian-jira-unmangle-edit
// @require https://github.com/binki/binki-userscript-delay-async/raw/252c301cdbd21eb41fa0227c49cd53dc5a6d1e58/binki-userscript-delay-async.js
// @require https://github.com/binki/binki-userscript-when-element-changed-async/raw/88cf57674ab8fcaa0e86bdf5209342ec7780739a/binki-userscript-when-element-changed-async.js
// @require https://github.com/binki/binki-userscript-when-element-query-selector-async/raw/0a9c204bdc304a9e82f1c31d090fdfdf7b554930/binki-userscript-when-element-query-selector-async.js
// ==/UserScript==

(async () => {
  const descriptionTextBox = await whenElementQuerySelectorAsync(document.body, '[data-component-selector="jira.issue-view.common.inline-edit.compact-wrapper-control"] .ak-renderer-document');
  if ([...descriptionTextBox.querySelectorAll('a')].find(a => a.href && a.href !== unmangleLink(a.href))) {
    console.log('detected links to fix in description');
    
    // Click on the description to start editing it.
    // Not sure why both the method and two events are required to make this work, but it does work.
    descriptionTextBox.click();
    descriptionTextBox.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    }));
    descriptionTextBox.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));
    console.log('clicked on the description to start editing it');
    
    await editOpenedTextAreaAsync();
  } else {
    console.log('no links to fix in description');
  }
  
  // Continuously monitor the comment listing since new comments may automatically populate.
  while (true) {
    const commentsList = await whenElementQuerySelectorAsync(document.body, '[data-testid="issue.activity.comments-list"]');
    
    for (const commentContent of document.querySelectorAll('[data-testid^="issue-comment-base.ui.comment.ak-comment"][data-testid$="-content"]')) {
      if ([...commentContent.querySelectorAll('a')].find(a => a.href && a.href !== unmangleLink(a.href))) {
        console.log('found comment or note requiring edits', commentContent);
        
        const commentContainer = commentContent.closest('[data-testid^="comment-base-item-"]');
        const editButton = commentContainer.querySelector('[data-testid$="footer"] button');
        console.log('clicking Edit on comment (hopefully not Delete!)');
        editButton.click();
        console.log('clicked Edit');
        await editOpenedTextAreaAsync();
      }
    }
    
    // Wait for the next change.
    await whenElementChangedAsync(commentsList);
  }
})();

async function editOpenedTextAreaAsync() {
  console.log('waiting for editable textarea to appear…');
  // Wait for the editable text to appear.
  const descriptionEditorTextArea = await whenElementQuerySelectorAsync(document.body, '#ak-editor-textarea');

  console.log('editing…');
  // This is complicated. We have to clear and re-append everything. Otherwise the editor fails at seeing our edits.
  const elements = [...descriptionEditorTextArea.childNodes];
  for (const element of elements) {
    element.remove();
  }
  // This is necessary somehow
  await delayAsync(0);
  for (const element of elements) {
    // Cannot use querySelector in detached elements (at least it wasn’t working), so have to check all children manually.
    for (const child of element.childNodes) {
      console.log('considering child node', child.tagName, child.href, child);
      if ((child.tagName || '').toLowerCase() !== 'a') continue;
      if (!child.href) continue;
      const newHref = unmangleLink(child.href);
      if (child.href === newHref) continue;
      console.log(`Replacing link “${child.href}” with “${newHref}”.`);
      child.href = newHref;
    }
    descriptionEditorTextArea.append(element);
  }
  // Wait for the new stuff to be acknowledged by the WYSIWYG editor
  await delayAsync(0);
  // Remove the empty p that was added by the editor
  while (true) {
    const firstP = descriptionEditorTextArea.firstChild;
    if (!firstP || !firstP.tagName || firstP.tagName.toLowerCase() !== 'p' || firstP.textContent !== '') break;
    firstP.remove();
  }
  console.log('edited');

  // Now click on the save button.
  (await whenElementQuerySelectorAsync(document.body, '[data-testid="comment-save-button"]')).click();
  console.log('saving.');
}

function unmangleLink(link) {
  if (link.startsWith('https://nam10.safelinks.protection.outlook.com/')) return new URL(link).searchParams.get('url');
	return link;
}
