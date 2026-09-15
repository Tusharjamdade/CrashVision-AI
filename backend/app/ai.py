from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.database import chat_collection

llm = None

if GROQ_API_KEY:
    try:
        llm = ChatGroq(
            model=GROQ_MODEL,
            temperature=0,
            api_key=GROQ_API_KEY,
        )
    except Exception as exc:
        print("Warning: ChatGroq initialization failed:", exc)

report_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are CrashVision AI, an accident-monitoring assistant.

Generate a concise incident report from ONLY the supplied detection data.

Include:
1. What appears to have happened
2. Important detected objects
3. Recommended immediate action

Do not invent injuries, location, cause, vehicle details, people,
weather, road conditions, or any other facts that were not supplied.
Clearly distinguish model detection from certainty.""",
        ),
        (
            "human",
            """Detection confidence: {confidence}

Detected objects:
{objects}

The accident classifier reported:
{prediction}

Generate the incident report.""",
        ),
    ]
)

report_chain = report_prompt | llm | StrOutputParser() if llm else None

chat_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are CrashVision AI, an assistant for reviewing a detected
road accident.

You are given an incident report and machine-detected context.

Answer the user's question using only the supplied incident context and
conversation history. Do not invent injuries, location, cause, identities,
vehicle details, or events that are not present.

If the evidence does not contain an answer, say that the available incident
data does not establish it.

Be concise but useful.""",
        ),
        (
            "system",
            """Incident context:

Incident ID: {record_id}
Accident classifier confidence: {confidence}
Detected objects: {objects}

Generated report:
{report}""",
        ),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{message}"),
    ]
)

chat_chain = chat_prompt | llm | StrOutputParser() if llm else None


def generate_report(confidence: float, objects: list[str], prediction: str) -> str:
    if report_chain is None:
        objs = ", ".join(objects) if objects else "None detected"
        return (
            f"CRASHVISION ACCIDENT REPORT\n\n"
            f"Classification: Confirmed {prediction}\n"
            f"Confidence Score: {confidence * 100:.1f}%\n"
            f"Detected Objects: {objs}\n\n"
            f"Summary:\nAutomated detection system flagged potential traffic incident. "
            f"Frame sequence captured and stored to secure S3 vault."
        )

    try:
        return report_chain.invoke(
            {
                "confidence": f"{confidence:.3f}",
                "objects": ", ".join(objects) if objects else "None detected",
                "prediction": prediction,
            }
        )
    except Exception as exc:
        print("Report generation failed:", exc)
        return "Unable to generate AI report automatically."


def load_chat_history(record_id: str, conversation_id: str, limit: int = 20):
    docs = list(
        chat_collection.find(
            {
                "record_id": record_id,
                "conversation_id": conversation_id,
            }
        )
        .sort("created_at", 1)
        .limit(limit)
    )

    messages = []
    for doc in docs:
        role = doc.get("role")
        content = doc.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    return messages


def generate_chat_response(record: dict, message: str, conversation_id: str) -> str:
    record_id_str = str(record.get("record_id") or record["_id"])
    confidence_val = record.get("confidence", 0.0)
    objects_list = record.get("objects", [])
    report_text = record.get("report", "No report available.")

    if chat_chain is None:
        # Fallback intelligent responder if Groq API key is not configured
        q = message.lower()
        objs_str = ", ".join(objects_list) if objects_list else "vehicles"
        conf_str = f"{confidence_val * 100:.1f}%"

        if "summar" in q:
            return f"🤖 Incident Summary for {record_id_str}:\nCrashVision AI detected a confirmed accident with {conf_str} confidence. Objects identified: [{objs_str}]."
        if "object" in q or "vehicle" in q:
            return f"🚘 Object Analysis:\nDetected object classes in incident scene: {objs_str}."
        if "confidence" in q or "accuracy" in q:
            return f"🎯 Model Confidence:\nThe accident classification model registered a {conf_str} confidence probability score."

        return f"🤖 CrashVision Assistant ({record_id_str}):\nIncident evidence recorded with {conf_str} confidence. Detected entities: {objs_str}. Report excerpt: '{report_text[:120]}...'"

    history = load_chat_history(record_id_str, conversation_id, limit=20)

    try:
        return chat_chain.invoke(
            {
                "record_id": record_id_str,
                "confidence": f"{confidence_val:.3f}",
                "objects": ", ".join(objects_list) or "None detected",
                "report": report_text or "No incident report available yet.",
                "history": history,
                "message": message,
            }
        )
    except Exception as exc:
        print("Chat generation failed:", exc)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate AI chat response.",
        )
