import EventObject = GoogleAppsScript.Addons.EventObject;

function onDriveItemsSelected(e: GoogleAppsScript.Addons.EventObject) {
    const item = e.drive!.activeCursorItem;
    if (item.mimeType != 'application/vnd.google-apps.folder') {
        return createHomepageCard()
    } else {
        return createFilesCard(DriveApp.getFolderById(item.id));
    }
}

const messages = {
    en: {
        selectFiles: 'Select a folder.',
        renameFiles: 'Rename files',
        renamedNFiles: 'Renamed {count} files.',
        renamedOneFile: 'Renamed 1 file.',
        searchText: 'Search',
        replaceText: 'Replace',
        useRegExp: "Use regular expression",
        recursive: "Recursive"
    }
}

function i18n(resource: string, replace?: { [ID: string]: string }): string {
    const locale = Session.getActiveUserLocale()
    const localeMessages = messages[locale] || messages['en']
    let message = localeMessages[resource] || resource
    if (replace) {
        for (const k in replace) {
            message = message.replace(`{${k}}`, replace[k])
        }
    }
    return message
}

function onHomepage() {
    return createHomepageCard();
}

function createHomepageCard() {
    return CardService.newCardBuilder().addSection(CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText(i18n('selectFiles'))
    )).setFixedFooter(footer()).build();
}

function footer() {
    return CardService.newFixedFooter()
        .setPrimaryButton(
            CardService.newTextButton().setText(i18n('viewSource'))
                .setOpenLink(
                    CardService.newOpenLink().setUrl('https://github.com/roblovelock/google-drive-bulk-actions')
                )
        );
}

function createFilesCard(folder: GoogleAppsScript.Drive.Folder) {
    const itemWidget = CardService.newDecoratedText()
        .setText(folder.getName());


    const action = CardService.newAction()
        .setFunctionName('onRenameFiles')
        .setParameters({folder: folder.getId()});
    const button = CardService.newTextButton()
        .setText(i18n('renameFiles'))
        .setOnClickAction(action)
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

    const buttonSet = CardService.newButtonSet()
        .addButton(button);

    const card = CardService.newCardBuilder()
        .addSection(CardService.newCardSection()
            .addWidget(itemWidget)
            .addWidget(
                CardService.newTextInput()
                    .setFieldName("search_text")
                    .setTitle(i18n('searchText'))
            ).addWidget(
                CardService.newTextInput()
                    .setFieldName("replace_text")
                    .setTitle(i18n('replaceText'))
            ).addWidget(
                CardService.newSelectionInput()
                    .setType(CardService.SelectionInputType.CHECK_BOX)
                    .setFieldName("is_regex")
                    .addItem(i18n("useRegExp"), "true", false)
            ).addWidget(
                CardService.newSelectionInput()
                    .setType(CardService.SelectionInputType.CHECK_BOX)
                    .setFieldName("is_recursive")
                    .addItem(i18n("recursive"), "true", false)
            )
        ).addSection(CardService.newCardSection().addWidget(buttonSet))
        .setFixedFooter(footer());

    return card.build();
}

function renameFiles(files: GoogleAppsScript.Drive.FileIterator, isRegex: boolean, searchText, replaceText) {
    let count = 0;
    while (files.hasNext()) {
        const file = files.next();
        if (isRegex && file.getName().match(searchText)) {
            file.setName(file.getName().replace(new RegExp(searchText), replaceText))
            count++
        } else if (file.getName().includes(searchText)) {
            file.setName(file.getName().replace(searchText, replaceText))
            count++
        }
    }
    return count;
}

function renameFilesInSubFolders(folder: GoogleAppsScript.Drive.Folder, isRegex: boolean, searchText, replaceText) {
    let count = 0
    const subFolders = folder.getFolders()
    while (subFolders.hasNext()) {
        const subFolder = subFolders.next()
        count += renameFiles(subFolder.getFiles(), isRegex, searchText, replaceText);
        count += renameFilesInSubFolders(subFolder, isRegex, searchText, replaceText)
    }
    return count;
}

function onRenameFiles(e: EventObject) {
    const folderId = e.commonEventObject.parameters.folder;
    const searchText = (e as any).formInput.search_text || ""
    const replaceText = (e as any).formInput.replace_text || ""
    const isRegex = (e as any).formInput.is_regex == "true"
    const isRecursive = (e as any).formInput.is_recursive == "true"

    const folder = DriveApp.getFolderById(folderId)
    let count = renameFiles(folder.getFiles(), isRegex, searchText, replaceText);
    if (isRecursive) {
        count = renameFilesInSubFolders(folder, isRegex, searchText, replaceText);
    }

    const phrase = count == 1 ? 'renamedOneFile' : 'renamedNFiles';
    return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
            .setText(i18n(phrase, {count: '' + count})))
        .build();
}
