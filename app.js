const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();

require('dotenv').config()

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

const uri = process.env.ATLAS_URI_TODO;

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })

const connection = mongoose.connection;
connection.once('open', () => {
    console.log("MongoDB database connection established successfully");
})

const itemsSchema = mongoose.Schema({
    title: String,
    checked: Boolean
})

const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
    title: "Welcome to Todo List App",
    checked: false
})

const item2 = new Item({
    title: "Add New Item and Hit the + button to add a ToDo",
    checked: false
})

const item3 = new Item({
    title: "Tick the box to mark an item as completed and move to completed section below, remove the tick to move back",
    checked: false
})

const item4 = new Item({
    title: "Hit x button to delete an item",
    checked: false
})

const item5 = new Item({
    title: "Delete all to see the tips again ;)",
    checked: false
})

const item6 = new Item({
    title: "Remove the tick to move back to todo list",
    checked: true
})

const defaultItems = [item1, item2, item3, item4, item5, item6];

app.get('/', (req, res) => {
    Item.find()
        .catch((err) => {
            console.log(err)
        }).then(foundItems => {
            if (foundItems.length === 0) {
                Item.insertMany(defaultItems)
                    .catch((err) => {
                        console.log(err)
                    }).then(res.redirect('/'))

            } else {
                res.render("list", {
                    listTitle: "ToDoNaaZ", newListItems: foundItems
                })

            }
        })
})

app.post('/', (req, res) => {
    const itemTitle = req.body.newItem;

    const item = new Item({
        title: itemTitle,
        checked: false
    })

    item.save()
        .catch((err) => {
            console.log(err)
        }).then(res.redirect('/'))
})

app.post("/delete", (req, res) => {
    const deleteItem = req.body.deleteItem;
    Item.findByIdAndRemove(deleteItem)
        .catch((err) => {
            console.log(err)
        }).then(res.redirect('/'))
})

app.post("/update", (req, res) => {
    let itemId = req.body.itemId;
    let checked = (req.body.checked === 'true')

    Item.findOneAndUpdate({ _id: itemId }, { $set: { checked: !checked } })
        .catch((err) => {
            console.log(err)
        })
        .then(res.redirect('/'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log("server started in port 3000")
})
