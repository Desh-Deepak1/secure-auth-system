const fs = require('fs');
const path = require('path');
const sdk = require('node-appwrite');
require('dotenv').config();

async function seedAppwrite() {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new sdk.Users(client);
  const databases = new sdk.Databases(client);

  const dataPath = path.join(__dirname, '..', 'public', 'seed-data.json');
  const rawData = fs.readFileSync(dataPath);
  const seedData = JSON.parse(rawData);

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = 'files';

  for (const user of seedData.users) {
    let createdUser;
    try {
      createdUser = await users.create(user.id, user.email, null, user.password, user.profile.fullName);
    } catch (error) {
      if (error.code === 409) {
        createdUser = await users.get(user.id);
      } else {
        throw error;
      }
    }

    for (const file of user.files) {
      try {
        await databases.createDocument(
          databaseId,
          collectionId,
          file.id,
          {
            ownerId: user.id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            uploadedAt: file.uploadedAt
          },
          [
            sdk.Permission.read(sdk.Role.user(user.id)),
            sdk.Permission.write(sdk.Role.user(user.id))
          ]
        );
      } catch (error) {
        if (error.code !== 409) {
          throw error;
        }
      }
    }
  }
  console.log("Appwrite Database seeded successfully!");
  process.exit();
}

seedAppwrite().catch(err => {
  console.error(err);
  process.exit(1);
});